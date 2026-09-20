// Grid-based A* routing so wires detour around boxes they aren't connected
// to, instead of cutting straight through them. Routing depends only on
// layout geometry, not on live signal values, so it's computed once per
// definition/canvas-size as part of computeLayout — never recomputed just
// because a pin value changed.

import type { ComponentDefinition, PinRef } from '$lib/schemas/circuit';
import type { Point, ChildLayout } from './layout';

export interface RoutedWire {
	// readonly wireId: string;
	readonly toIndex: number;
	readonly from: PinRef;
	readonly to: PinRef;
	readonly points: readonly Point[];
}

interface Geometry {
	readonly selfInputPos: Readonly<Record<string, Point>>;
	readonly selfOutputPos: Readonly<Record<string, Point>>;
	readonly children: Readonly<Record<string, ChildLayout>>;
}

const CELL = 10;
const STUB = CELL; // how far a wire pokes out from a box before pathfinding takes over
const CONGESTION_WEIGHT = 4; // extra cost per prior wire already using a cell

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

// Orthogonal A*, biased toward straight runs via a turn penalty, and away
// from cells other wires have already claimed via a congestion penalty.
// Congestion is a SOFT cost, never a hard block — two wires can still
// share a cell if there's genuinely no room to spread apart, they'll just
// prefer not to when an alternative exists.
function astar(
	start: Point,
	goal: Point,
	blocked: boolean[][],
	cols: number,
	rows: number,
	congestion: ReadonlyMap<number, number>,
): Point[] | null {
	const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
	const sr = clamp(Math.round(start.y / CELL), rows);
	const sc = clamp(Math.round(start.x / CELL), cols);
	const gr = clamp(Math.round(goal.y / CELL), rows);
	const gc = clamp(Math.round(goal.x / CELL), cols);

	const key = (r: number, c: number) => r * cols + c;
	const heuristic = (r: number, c: number) => Math.abs(r - gr) + Math.abs(c - gc);

	const gScore = new Map<number, number>();
	const fScore = new Map<number, number>();
	const cameFrom = new Map<number, number>();
	const dirOf = new Map<number, number>();
	const open = new Set<number>();

	const startKey = key(sr, sc);
	gScore.set(startKey, 0);
	fScore.set(startKey, heuristic(sr, sc));
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
		let bestF = Infinity;
		for (const k of open) {
			const fv = fScore.get(k)!;
			if (fv < bestF) {
				bestF = fv;
				bestKey = k;
			}
		}
		open.delete(bestKey);

		const r = Math.floor(bestKey / cols);
		const c = bestKey % cols;
		if (r === gr && c === gc) {
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

		const curG = gScore.get(bestKey)!;
		const curDir = dirOf.get(bestKey) ?? -1;
		for (const [dr, dc, id] of dirs) {
			const nr = r + dr;
			const nc = c + dc;
			if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
			if (blocked[nr][nc] && !(nr === gr && nc === gc)) continue;

			const turnPenalty = curDir !== -1 && curDir !== id ? 3 : 0;
			const congestionPenalty = (congestion.get(key(nr, nc)) ?? 0) * CONGESTION_WEIGHT;
			const tentativeG = curG + 1 + turnPenalty + congestionPenalty;
			const nKey = key(nr, nc);
			if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
				gScore.set(nKey, tentativeG);
				fScore.set(nKey, tentativeG + heuristic(nr, nc));
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
	if (!pin) console.log(ref.pinId, ref.component);
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
		wire.to.forEach((toRef, toIndex) => {
			const dest = resolveEndpoint(geometry, toRef);
			const gridPath = astar(source.stub, dest.stub, blocked, cols, rows, congestion);
			const routedThroughGrid = gridPath ?? [source.stub, dest.stub]; // fall back to a direct line if pathfinding fails
			markCongestion(congestion, routedThroughGrid, cols);
			const full = simplify([source.pin, ...routedThroughGrid, dest.pin]);
			routes.push({ toIndex, from: wire.from, to: toRef, points: full });
		});
	}

	return routes;
}
