// Pure layout: given a definition, compute where its boundary pins and its
// children's boxes/pins should sit. This is what makes the renderer generic
// — no per-definition drawing code needed, unlike the earlier HTML demo
// which hand-positioned every box for exactly one circuit.

import { getDefinition, getSizeForDefinition } from '#sim/model/component';
import type { DefinitionLibrary } from '$lib/schemas/circuit';
import { gateShapeFor, isCompactGate } from './gateShapes';
import type { RoutedWire } from './routing';
import { computeRoutes } from './routing';

export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface ChildLayout {
	readonly instanceId: string;
	readonly definitionId: string;
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
	readonly inputPos: Readonly<Record<string, Point>>;
	readonly outputPos: Readonly<Record<string, Point>>;
	readonly inputStubPos: Readonly<Record<string, Point>>;
	readonly outputStubPos: Readonly<Record<string, Point>>;

	readonly inoutPos: Readonly<Record<string, Point>>;
	readonly inoutStubPos: Readonly<Record<string, Point>>;
}

export interface Layout {
	readonly selfInputPos: Readonly<Record<string, Point>>;
	readonly selfOutputPos: Readonly<Record<string, Point>>;
	readonly children: Readonly<Record<string, ChildLayout>>;
	readonly routes: readonly RoutedWire[];

	readonly selfInoutPos: Readonly<Record<string, Point>>;
}

const BOX_WIDTH = 100;
const PIN_SPACING = 20;
const BOUNDARY_MARGIN = 40;
const STUB = 40;
const HORIZONTAL_GROUP_GAP = 150;

const layoutCache = new WeakMap<DefinitionLibrary, Map<string, Layout>>();

export function computeLayout(
	lib: DefinitionLibrary,
	definitionId: string,
	canvasWidth: number,
	canvasHeight: number,
): Layout {
	const minCanvasSize = getSizeForDefinition(lib, definitionId);
	const width = Math.max(minCanvasSize.minCanvasWidth ?? 0, canvasWidth);
	const height = Math.max(minCanvasSize.minCanvasHeight ?? 0, canvasHeight);
	const cacheKey = `${definitionId}:${width}x${height}`;
	let libCache = layoutCache.get(lib);
	if (!libCache) {
		libCache = new Map();
		layoutCache.set(lib, libCache);
	}
	const cached = libCache.get(cacheKey);
	if (cached) return cached;

	const result = computeLayoutUncached(lib, definitionId, width, height);
	libCache.set(cacheKey, result);
	return result;
}

export function computeLayoutUncached(
	lib: DefinitionLibrary,
	definitionId: string,
	canvasWidth: number,
	canvasHeight: number,
): Layout {
	const def = getDefinition(lib, definitionId);

	const selfInputPos: Record<string, Point> = {};
	def.inputs.forEach((pin, i) => {
		selfInputPos[pin.id] = { x: BOUNDARY_MARGIN, y: 50 + i * PIN_SPACING * 2 };
	});

	const selfOutputPos: Record<string, Point> = {};
	def.outputs.forEach((pin, i) => {
		selfOutputPos[pin.id] = { x: canvasWidth - BOUNDARY_MARGIN, y: 50 + i * PIN_SPACING * 2 };
	});

	const selfInoutPos: Record<string, Point> = {};
	def.inouts?.forEach((pin, i) => {
		selfInoutPos[pin.id] = {
			x: canvasWidth - BOUNDARY_MARGIN,
			y: 50 + (def.outputs.length + i) * PIN_SPACING * 2,
		};
	});

	const children: Record<string, ChildLayout> = {};
	if (def.kind === 'composite') {
		const usableWidth = Math.max(canvasWidth - 260, BOX_WIDTH);
		const VERTICAL_GAP = 80;

		// Group children by column. A child with no explicit column falls back
		// to its own declaration index — meaning "no column specified anywhere"
		// produces exactly one child per column, in original order, which is
		// byte-identical to the layout before columns existed.
		const columns = new Map<number, (typeof def.children)[number][]>();
		def.children.forEach((child, i) => {
			const col = child.column ?? i;
			const list = columns.get(col);
			if (list) list.push(child);
			else columns.set(col, [child]);
		});

		const sortedColumnKeys = [...columns.keys()].sort((a, b) => a - b);
		const numColumns = sortedColumnKeys.length;

		// First pass: size every column, and note the horizontal group its
		// children belong to (the groupName shared by children placed in it).
		const columnInfos = sortedColumnKeys.map((colKey) => {
			const childrenInColumn = columns.get(colKey)!;
			const sized = childrenInColumn.map((child) => {
				const childDef = getDefinition(lib, child.definitionId);
				const compact = childDef.kind === 'primitive' && isCompactGate(gateShapeFor(childDef.id));

				const rightCount = childDef.outputs.length + (childDef.inouts?.length ?? 0);
				const pinCount = Math.max(childDef.inputs.length, rightCount, 1);
				const w = compact ? 64 : BOX_WIDTH;
				const h = compact ? pinCount * 20 + 20 : pinCount * PIN_SPACING + 24;
				return { child, childDef, w, h };
			});
			const colWidth = Math.max(...sized.map((s) => s.w));
			const groupName = sized.find((s) => s.child.groupName)?.child.groupName;
			return { sized, colWidth, groupName };
		});

		// Second pass: resolve the horizontal gap between each pair of adjacent
		// columns. Columns sharing a horizontal group are pulled close together;
		// the remaining ("normal") gaps split whatever width that frees up, so
		// the overall layout still spans the canvas the way it used to.
		const rawGaps = columnInfos.slice(0, -1).map((info, i) => {
			const grouped =
				info.groupName !== undefined && info.groupName === columnInfos[i + 1].groupName;
			return grouped ? HORIZONTAL_GROUP_GAP : null;
		});
		const totalColWidth = columnInfos.reduce((sum, c) => sum + c.colWidth, 0);
		const groupGapTotal = rawGaps.reduce((sum: number, g) => sum + (g ?? 0), 0);
		const normalGapCount = rawGaps.filter((g) => g === null).length;
		const remainingWidth = Math.max(usableWidth - totalColWidth - groupGapTotal, 0);
		const normalGap = normalGapCount > 0 ? remainingWidth / normalGapCount : 0;
		const resolvedGaps = rawGaps.map((g) => g ?? normalGap);

		// Third pass: place columns left-to-right using the resolved gaps, and
		// lay out each column's children as before.
		let x =
			numColumns <= 1
				? BOUNDARY_MARGIN + 90 + 0.5 * (usableWidth - (columnInfos[0]?.colWidth ?? 0))
				: BOUNDARY_MARGIN + 90;

		columnInfos.forEach(({ sized, colWidth }, colIndex) => {
			// Anchor columns near the top of the canvas instead of vertically centering them
			let y = BOUNDARY_MARGIN + 20;

			for (const { child, childDef, w, h } of sized) {
				const centerY = y + h / 2;
				const inputPos: Record<string, Point> = {};
				const inputStubPos: Record<string, Point> = {};
				childDef.inputs.forEach((pin, pi) => {
					const offset = (pi - (childDef.inputs.length - 1) / 2) * PIN_SPACING;
					inputPos[pin.id] = { x, y: centerY + offset };
					// Stagger input stubs further left the further they are from center/top
					const stubDepth = STUB + pi * 10;
					inputStubPos[pin.id] = { x: x - stubDepth, y: centerY + offset };
				});

				const outputPos: Record<string, Point> = {};
				const outputStubPos: Record<string, Point> = {};
				const inoutPos: Record<string, Point> = {};
				const inoutStubPos: Record<string, Point> = {};
				const rightPins = [...childDef.outputs, ...(childDef.inouts ?? [])];
				rightPins.forEach((pin, pi) => {
					const offset = (pi - (rightPins.length - 1) / 2) * PIN_SPACING;
					const stubDepth = STUB + pi * 10;
					const isInout = pi >= childDef.outputs.length;
					(isInout ? inoutPos : outputPos)[pin.id] = { x: x + w, y: centerY + offset };
					(isInout ? inoutStubPos : outputStubPos)[pin.id] = {
						x: x + w + stubDepth,
						y: centerY + offset,
					};
				});

				children[child.instanceId] = {
					instanceId: child.instanceId,
					definitionId: child.definitionId,
					x,
					y,
					w,
					h,
					inputPos,
					outputPos,
					inputStubPos,
					outputStubPos,
					inoutPos,
					inoutStubPos,
				};

				y += h + VERTICAL_GAP;
			}

			if (colIndex < resolvedGaps.length) {
				x += colWidth + resolvedGaps[colIndex];
			}
		});
	}

	const geometry = { selfInputPos, selfOutputPos, selfInoutPos, children };
	const routes = computeRoutes(def, geometry, canvasWidth, canvasHeight);
	return { ...geometry, routes };
}
