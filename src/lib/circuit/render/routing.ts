// Grid-based A* routing so wires detour around boxes they aren't connected
// to, instead of cutting straight through them. Routing depends only on
// layout geometry, not on live signal values, so it's computed once per
// definition/canvas-size as part of computeLayout — never recomputed just
// because a pin value changed.

import type { ComponentDefinition, PinRef } from '$lib/schemas/circuit';
import type { Point, ChildLayout } from './layout';

export interface RoutedWire {
	readonly wireId: string;
	readonly toIndex: number;
	readonly from: PinRef;
	readonly to: PinRef;
	readonly points: readonly Point[];
	readonly colour?: string;
	readonly groupName?: string;
}

interface Geometry {
	readonly selfInputPos: Readonly<Record<string, Point>>;
	readonly selfOutputPos: Readonly<Record<string, Point>>;
	readonly children: Readonly<Record<string, ChildLayout>>;
}

const CELL = 10;
const STUB = CELL * 4;
const BOX_PADDING = 2; // Clearance cells around components
const CONGESTION_WEIGHT = 4; // Base weight multiplied quadratically for sharing cells
const TURN_WEIGHT = 3; // Cost for a wire making its own turn
const TURN_CLUTTER_WEIGHT = 6; // Extra cost for routing through a cell where another wire is turning
const PROXIMITY_RADIUS = 6; // How many cells away from a box the repulsion field reaches
const MAX_PROXIMITY_PENALTY = 15; // Extra cost for cells immediately adjacent to boxes

function buildBlockedGrid(
	children: Readonly<Record<string, ChildLayout>>,
	width: number,
	height: number,
) {
	const cols = Math.max(1, Math.ceil((Number.isFinite(width) ? width : 800) / CELL));
	const rows = Math.max(1, Math.ceil((Number.isFinite(height) ? height : 600) / CELL));
	const blocked: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));

	for (const box of Object.values(children)) {
		if (
			!box ||
			typeof box.x !== 'number' ||
			typeof box.y !== 'number' ||
			typeof box.w !== 'number' ||
			typeof box.h !== 'number'
		) {
			continue;
		}
		const c0 = Math.max(0, Math.floor(box.x / CELL) - BOX_PADDING);
		const c1 = Math.min(cols, Math.ceil((box.x + box.w) / CELL) + BOX_PADDING);
		const r0 = Math.max(0, Math.floor(box.y / CELL) - BOX_PADDING);
		const r1 = Math.min(rows, Math.ceil((box.y + box.h) / CELL) + BOX_PADDING);

		for (let r = r0; r < r1; r++) {
			for (let c = c0; c < c1; c++) {
				if (blocked[r] && blocked[r][c] !== undefined) {
					blocked[r][c] = true;
				}
			}
		}
	}
	return { blocked, cols, rows };
}

function buildProximityMap(
	children: Readonly<Record<string, ChildLayout>>,
	cols: number,
	rows: number,
): Map<number, number> {
	const proximityMap = new Map<number, number>();
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = c * CELL;
			const y = r * CELL;
			let minDist = Infinity;
			for (const box of Object.values(children)) {
				if (!box) continue;
				const dx = Math.max(box.x - x, 0, x - (box.x + box.w));
				const dy = Math.max(box.y - y, 0, y - (box.y + box.h));
				const dist = Math.hypot(dx, dy);
				if (dist < minDist) {
					minDist = dist;
				}
			}
			const cellDist = minDist / CELL;
			if (cellDist < PROXIMITY_RADIUS) {
				const penalty = Math.round(
					(PROXIMITY_RADIUS - cellDist) * (MAX_PROXIMITY_PENALTY / PROXIMITY_RADIUS),
				);
				proximityMap.set(r * cols + c, penalty);
			}
		}
	}
	return proximityMap;
}

function cellKeyOfPoint(p: Point, cols: number): number {
	const r = Math.round(p.y / CELL);
	const c = Math.round(p.x / CELL);
	return r * cols + c;
}

function multiGoalSearch(
	start: Point,
	goalCells: ReadonlySet<number>,
	blocked: boolean[][],
	cols: number,
	rows: number,
	congestion: ReadonlyMap<number, number>,
	groupCells: ReadonlyMap<string, ReadonlySet<number>>,
	wireGroupName: string | undefined,
	proximityMap: ReadonlyMap<number, number>,
	turnCells: ReadonlyMap<number, number>,
): Point[] | null {
	if (
		!start ||
		typeof start.x !== 'number' ||
		typeof start.y !== 'number' ||
		rows <= 0 ||
		cols <= 0
	) {
		return null;
	}

	const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
	const sr = clamp(Math.round(start.y / CELL), rows);
	const sc = clamp(Math.round(start.x / CELL), cols);
	const key = (r: number, c: number) => r * cols + c;

	const startKey = key(sr, sc);
	if (goalCells.has(startKey)) return [start];

	const gScore = new Map<number, number>();
	const cameFrom = new Map<number, number>();
	const dirOf = new Map<number, number>();
	const open = new Set<number>();

	gScore.set(startKey, 0);
	open.add(startKey);

	const dirs: readonly [number, number, number][] = [
		[-1, 0, 0], // Up (vertical)
		[1, 0, 1], // Down (vertical)
		[0, -1, 2], // Left (horizontal)
		[0, 1, 3], // Right (horizontal)
	];

	const groupSet = wireGroupName ? groupCells.get(wireGroupName) : undefined;

	let guard = 0;
	while (open.size > 0) {
		if (++guard > 150_000) return null;

		let bestKey = -1;
		let bestG = Infinity;
		for (const k of open) {
			const gv = gScore.get(k)!;
			if (gv < bestG) {
				bestG = gv;
				bestKey = k;
			}
		}
		open.delete(bestKey);

		if (goalCells.has(bestKey)) {
			const path: Point[] = [];
			let cursor: number | undefined = bestKey;
			while (cursor !== undefined) {
				const pr = Math.floor(cursor / cols);
				const pc = cursor % cols;
				path.push({ x: pc * CELL, y: pr * CELL });
				cursor = cameFrom.get(cursor);
			}
			return path.reverse();
		}

		const r = Math.floor(bestKey / cols);
		const c = bestKey % cols;
		const curDir = dirOf.get(bestKey) ?? -1;

		for (const [dr, dc, id] of dirs) {
			const nr = r + dr;
			const nc = c + dc;
			if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
			const nKey = key(nr, nc);

			if (blocked[nr]?.[nc] && !goalCells.has(nKey)) continue;

			// Group attraction: lower cost if adjacent to wires in the same group
			let stepCost = 3;
			if (groupSet) {
				for (const [adr, adc] of [
					[-1, 0],
					[1, 0],
					[0, -1],
					[0, 1],
				]) {
					if (groupSet.has(key(nr + adr, nc + adc))) {
						stepCost = 1;
						break;
					}
				}
			}

			const turnPenalty = curDir !== -1 && curDir !== id ? TURN_WEIGHT : 0;

			// Quadratic congestion penalty: sharing a cell with existing wires becomes exponentially expensive
			const existingCount = congestion.get(nKey) ?? 0;
			const congestionPenalty = existingCount * existingCount * CONGESTION_WEIGHT;

			const proximityPenalty = proximityMap.get(nKey) ?? 0;
			const turnClutterPenalty = (turnCells.get(nKey) ?? 0) * TURN_CLUTTER_WEIGHT;

			const tentativeG =
				bestG + stepCost + turnPenalty + congestionPenalty + proximityPenalty + turnClutterPenalty;

			if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
				gScore.set(nKey, tentativeG);
				cameFrom.set(nKey, bestKey);
				dirOf.set(nKey, id);
				open.add(nKey);
			}
		}
	}
	return null;
}

function simplify(points: readonly Point[]): Point[] {
	if (!points || points.length < 3) return [...(points ?? [])];
	const out: Point[] = [points[0]];
	for (let i = 1; i < points.length - 1; i++) {
		const a = out[out.length - 1];
		const b = points[i];
		const c = points[i + 1];
		const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
		if (!collinear) out.push(b);
	}
	out.push(points[points.length - 1]);
	return out;
}

function resolveEndpoint(geometry: Geometry, ref: PinRef): { pin: Point; stub: Point } {
	if (ref.component === 'self') {
		const pin = geometry.selfInputPos?.[ref.pinId] ??
			geometry.selfOutputPos?.[ref.pinId] ?? { x: 0, y: 0 };
		return { pin, stub: pin };
	}
	const box = geometry.children[ref.component];
	if (!box) {
		const fallback = { x: 0, y: 0 };
		return { pin: fallback, stub: fallback };
	}
	const isInput = ref.pinId in box.inputPos;
	const pin = isInput ? box.inputPos[ref.pinId] : box.outputPos[ref.pinId];
	const safePin = pin ?? { x: box.x, y: box.y };
	const stub: Point = isInput
		? { x: box.x - STUB, y: safePin.y }
		: { x: box.x + box.w + STUB, y: safePin.y };
	const safeStub =
		stub ??
		(isInput ? { x: box.x - STUB, y: safePin.y } : { x: box.x + box.w + STUB, y: safePin.y });
	return { pin: safePin, stub: safeStub };
}

function markRouteData(
	grid: readonly Point[],
	cols: number,
	rows: number,
	congestion: Map<number, number>,
	turnCells: Map<number, number>,
	groupName: string | undefined,
	groupCells: Map<string, Set<number>>,
): void {
	if (!grid || grid.length < 2) return;

	// Detect and register bends/turns in the route grid
	for (let i = 1; i < grid.length - 1; i++) {
		const prev = grid[i - 1];
		const curr = grid[i];
		const next = grid[i + 1];
		const dir1x = Math.sign(curr.x - prev.x);
		const dir1y = Math.sign(curr.y - prev.y);
		const dir2x = Math.sign(next.x - curr.x);
		const dir2y = Math.sign(next.y - curr.y);
		if (dir1x !== dir2x || dir1y !== dir2y) {
			const r = Math.round(curr.y / CELL);
			const c = Math.round(curr.x / CELL);
			const key = r * cols + c;
			turnCells.set(key, (turnCells.get(key) ?? 0) + 1);
			for (const [dr, dc] of [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1],
			]) {
				const nk = (r + dr) * cols + (c + dc);
				turnCells.set(nk, (turnCells.get(nk) ?? 0) + 1);
			}
		}
	}

	// Mark line segments for congestion and grouping
	for (let i = 0; i < grid.length - 1; i++) {
		const p1 = grid[i];
		const p2 = grid[i + 1];
		if (!p1 || !p2) continue;

		const r1 = Math.round(p1.y / CELL);
		const c1 = Math.round(p1.x / CELL);
		const r2 = Math.round(p2.y / CELL);
		const c2 = Math.round(p2.x / CELL);

		const dr = Math.sign(r2 - r1);
		const dc = Math.sign(c2 - c1);
		let currR = r1;
		let currC = c1;

		let groupSet: Set<number> | undefined;
		if (groupName) {
			groupSet = groupCells.get(groupName);
			if (!groupSet) {
				groupSet = new Set<number>();
				groupCells.set(groupName, groupSet);
			}
		}

		let safetyGuard = 0;
		while (safetyGuard++ < 10_000) {
			const key = currR * cols + currC;
			congestion.set(key, (congestion.get(key) ?? 0) + 1);

			if (groupSet) {
				groupSet.add(key);
			}

			if (currR === r2 && currC === c2) break;
			currR += dr;
			currC += dc;
		}
	}
}

export function computeRoutes(
	def: ComponentDefinition,
	geometry: Geometry,
	canvasWidth: number,
	canvasHeight: number,
): RoutedWire[] {
	if (def.kind !== 'composite') return [];

	let maxExtX = Number.isFinite(canvasWidth) ? canvasWidth : 800;
	let maxExtY = Number.isFinite(canvasHeight) ? canvasHeight : 600;

	if (geometry.children) {
		for (const box of Object.values(geometry.children)) {
			if (box && typeof box.x === 'number' && typeof box.w === 'number') {
				maxExtX = Math.max(maxExtX, box.x + box.w);
			}
			if (box && typeof box.y === 'number' && typeof box.h === 'number') {
				maxExtY = Math.max(maxExtY, box.y + box.h);
			}
		}
	}
	if (geometry.selfInputPos) {
		for (const p of Object.values(geometry.selfInputPos)) {
			if (p && typeof p.x === 'number') maxExtX = Math.max(maxExtX, p.x);
			if (p && typeof p.y === 'number') maxExtY = Math.max(maxExtY, p.y);
		}
	}
	if (geometry.selfOutputPos) {
		for (const p of Object.values(geometry.selfOutputPos)) {
			if (p && typeof p.x === 'number') maxExtX = Math.max(maxExtX, p.x);
			if (p && typeof p.y === 'number') maxExtY = Math.max(maxExtY, p.y);
		}
	}

	const padding = CELL * 8;
	const routingWidth = maxExtX + padding;
	const routingHeight = maxExtY + padding;

	const { blocked, cols, rows } = buildBlockedGrid(geometry.children, routingWidth, routingHeight);
	const proximityMap = buildProximityMap(geometry.children, cols, rows);
	const congestion = new Map<number, number>();
	const turnCells = new Map<number, number>();
	const groupCells = new Map<string, Set<number>>();
	const routes: RoutedWire[] = [];

	if (!def.internalWires) return routes;

	for (const wire of def.internalWires) {
		const source = resolveEndpoint(geometry, wire.from);

		const treeCells = new Set<number>();
		treeCells.add(cellKeyOfPoint(source.pin, cols));
		treeCells.add(cellKeyOfPoint(source.stub, cols));

		if (wire.to) {
			wire.to.forEach((toRef, toIndex) => {
				const dest = resolveEndpoint(geometry, toRef);
				const pathToTree = multiGoalSearch(
					dest.stub,
					treeCells,
					blocked,
					cols,
					rows,
					congestion,
					groupCells,
					wire.groupName,
					proximityMap,
					turnCells,
				);
				const grid = pathToTree ?? [dest.stub, source.stub];

				markRouteData(grid, cols, rows, congestion, turnCells, wire.groupName, groupCells);
				for (const p of grid) treeCells.add(cellKeyOfPoint(p, cols));

				const branchFromJunctionToDest = [...grid].reverse();
				const prefix = toIndex === 0 ? [source.pin] : [];
				const full = simplify([...prefix, ...branchFromJunctionToDest, dest.pin]);
				routes.push({
					wireId: wire.id!,
					toIndex,
					from: wire.from,
					to: toRef,
					points: full,
					colour: wire.colour,
					groupName: wire.groupName,
				});
			});
		}
	}

	return routes;
}
