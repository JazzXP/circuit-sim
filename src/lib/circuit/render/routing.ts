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
}

interface Geometry {
	readonly selfInputPos: Readonly<Record<string, Point>>;
	readonly selfOutputPos: Readonly<Record<string, Point>>;
	readonly children: Readonly<Record<string, ChildLayout>>;
}

const CELL = 10;
const STUB = CELL * 2; // how far a wire pokes out from a box before pathfinding takes over
const CONGESTION_WEIGHT = 2; // extra cost per prior wire already using a cell
const TURN_WEIGHT = 5;

function buildBlockedGrid(
	children: Readonly<Record<string, ChildLayout>>,
	width: number,
	height: number,
) {
	const cols = Math.ceil(width / CELL);
	const rows = Math.ceil(height / CELL);
	const blocked: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
	for (const box of Object.values(children)) {
		const c0 = Math.max(0, Math.floor(box.x / CELL));
		const c1 = Math.min(cols, Math.ceil((box.x + box.w) / CELL));
		const r0 = Math.max(0, Math.floor(box.y / CELL));
		const r1 = Math.min(rows, Math.ceil((box.y + box.h) / CELL));
		for (let r = r0; r < r1; r++) {
			for (let c = c0; c < c1; c++) blocked[r][c] = true;
		}
	}
	return { blocked, cols, rows };
}

function cellKeyOfPoint(p: Point, cols: number): number {
	const r = Math.round(p.y / CELL);
	const c = Math.round(p.x / CELL);
	return r * cols + c;
}

// Uniform-cost (Dijkstra) search from `start` to the NEAREST cell in
// `goalCells`, rather than to one fixed point. This is what makes a
// multi-destination wire share a real trunk instead of every destination
// independently routing all the way back to the original source: each new
// destination searches for the closest point on the tree built so far
// (source plus every previously-routed branch) and attaches there. This
// is the standard greedy heuristic for a rectilinear Steiner tree — it
// minimizes total wire length and produces genuine branch points instead
// of several lines that just happen to start from the same coordinate.
//
// Heuristic is 0 (no A* guidance) rather than distance-to-nearest-goal,
// trading a bit of search efficiency for simplicity and correctness —
// fine given how small these grids are in practice (computeLayout results
// are cached anyway, so this only ever runs once per definition/size).
function multiGoalSearch(
	start: Point,
	goalCells: ReadonlySet<number>,
	blocked: boolean[][],
	cols: number,
	rows: number,
	congestion: ReadonlyMap<number, number>,
): Point[] | null {
	const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
	const sr = clamp(Math.round(start.y / CELL), rows);
	const sc = clamp(Math.round(start.x / CELL), cols);
	const key = (r: number, c: number) => r * cols + c;

	const startKey = key(sr, sc);
	if (goalCells.has(startKey)) return [start]; // already touching the tree

	const gScore = new Map<number, number>();
	const cameFrom = new Map<number, number>();
	const dirOf = new Map<number, number>();
	const open = new Set<number>();

	gScore.set(startKey, 0);
	open.add(startKey);

	const dirs: readonly [number, number, number][] = [
		[-1, 0, 0],
		[1, 0, 1],
		[0, -1, 2],
		[0, 1, 3],
	];

	let guard = 0;
	while (open.size > 0) {
		if (++guard > 50_000) return null; // safety valve — should never trigger on reasonable layouts

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
			return path.reverse(); // [start, ..., attachment point on the tree]
		}

		const r = Math.floor(bestKey / cols);
		const c = bestKey % cols;
		const curDir = dirOf.get(bestKey) ?? -1;
		for (const [dr, dc, id] of dirs) {
			const nr = r + dr;
			const nc = c + dc;
			if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
			const nKey = key(nr, nc);
			if (blocked[nr][nc] && !goalCells.has(nKey)) continue;

			const turnPenalty = curDir !== -1 && curDir !== id ? TURN_WEIGHT : 0;
			const congestionPenalty = (congestion.get(nKey) ?? 0) * CONGESTION_WEIGHT;
			const tentativeG = bestG + 1 + turnPenalty + congestionPenalty;
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
	if (points.length < 3) return [...points];
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

// Resolves a PinRef to its exact pin position, plus a "stub" point just
// outside the owning box (or identical to the pin itself for self/boundary
// pins, which are never inside a box).
function resolveEndpoint(geometry: Geometry, ref: PinRef): { pin: Point; stub: Point } {
	if (ref.component === 'self') {
		const pin = geometry.selfInputPos[ref.pinId] ?? geometry.selfOutputPos[ref.pinId];
		return { pin, stub: pin };
	}
	const box = geometry.children[ref.component];
	const isInput = ref.pinId in box.inputPos;
	const pin = isInput ? box.inputPos[ref.pinId] : box.outputPos[ref.pinId];
	const stub: Point = isInput
		? { x: box.x - STUB, y: pin.y }
		: { x: box.x + box.w + STUB, y: pin.y };
	return { pin, stub };
}

function markCongestion(
	congestion: Map<number, number>,
	points: readonly Point[],
	cols: number,
): void {
	for (const p of points) {
		const r = Math.round(p.y / CELL);
		const c = Math.round(p.x / CELL);
		const key = r * cols + c;
		congestion.set(key, (congestion.get(key) ?? 0) + 1);
	}
}

export function computeRoutes(
	def: ComponentDefinition,
	geometry: Geometry,
	canvasWidth: number,
	canvasHeight: number,
): RoutedWire[] {
	if (def.kind !== 'composite') return [];

	const { blocked, cols, rows } = buildBlockedGrid(geometry.children, canvasWidth, canvasHeight);
	const congestion = new Map<number, number>();
	const routes: RoutedWire[] = [];

	for (const wire of def.internalWires) {
		const source = resolveEndpoint(geometry, wire.from);

		// Every destination attaches to this set as it's routed, so later
		// destinations can branch off an earlier destination's path instead of
		// always going all the way back to the source — a real, growing tree.
		const treeCells = new Set<number>();
		treeCells.add(cellKeyOfPoint(source.pin, cols));
		treeCells.add(cellKeyOfPoint(source.stub, cols));

		wire.to.forEach((toRef, toIndex) => {
			const dest = resolveEndpoint(geometry, toRef);
			const pathToTree = multiGoalSearch(dest.stub, treeCells, blocked, cols, rows, congestion);
			const grid = pathToTree ?? [dest.stub, source.stub]; // fall back to a direct line if pathfinding fails

			markCongestion(congestion, grid, cols);
			for (const p of grid) treeCells.add(cellKeyOfPoint(p, cols));

			const branchFromJunctionToDest = [...grid].reverse(); // [attachment point, ..., dest.stub]
			// The very first branch always explicitly reaches the true source
			// pin, so the pin is never left visually disconnected even if this
			// branch happened to attach at the stub cell rather than the pin
			// cell (they're one grid cell apart).
			const prefix = toIndex === 0 ? [source.pin] : [];
			const full = simplify([...prefix, ...branchFromJunctionToDest, dest.pin]);
			routes.push({
				wireId: wire.id!,
				toIndex,
				from: wire.from,
				to: toRef,
				points: full,
				colour: wire.colour,
			});
		});
	}

	return routes;
}
