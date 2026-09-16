// Pure layout: given a definition, compute where its boundary pins and its
// children's boxes/pins should sit. This is what makes the renderer generic
// — no per-definition drawing code needed, unlike the earlier HTML demo
// which hand-positioned every box for exactly one circuit.

import { type DefinitionLibrary, getDefinition } from '#sim/model/component';
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
}

export interface Layout {
	readonly selfInputPos: Readonly<Record<string, Point>>;
	readonly selfOutputPos: Readonly<Record<string, Point>>;
	readonly children: Readonly<Record<string, ChildLayout>>;
	readonly routes: readonly RoutedWire[];
}

const BOX_WIDTH = 100;
const PIN_SPACING = 22;
const BOUNDARY_MARGIN = 40;

export function computeLayout(
	lib: DefinitionLibrary,
	definitionId: string,
	canvasWidth: number,
	canvasHeight: number
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

	const children: Record<string, ChildLayout> = {};
	if (def.kind === 'composite') {
		const usableWidth = Math.max(canvasWidth - 260, BOX_WIDTH);
		const VERTICAL_GAP = 24;

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

		sortedColumnKeys.forEach((colKey, colIndex) => {
			const childrenInColumn = columns.get(colKey)!;

			const sized = childrenInColumn.map((child) => {
				const childDef = getDefinition(lib, child.definitionId);
				const compact = childDef.kind === 'primitive' && isCompactGate(gateShapeFor(childDef.id));
				const pinCount = Math.max(childDef.inputs.length, childDef.outputs.length, 1);
				const w = compact ? 64 : BOX_WIDTH;
				const h = compact ? pinCount * 20 + 20 : pinCount * PIN_SPACING + 24;
				return { child, childDef, w, h };
			});

			const colWidth = Math.max(...sized.map((s) => s.w));
			const slot = numColumns <= 1 ? 0.5 : colIndex / (numColumns - 1);
			const x = BOUNDARY_MARGIN + 90 + slot * (usableWidth - colWidth);

			const totalHeight =
				sized.reduce((sum, s) => sum + s.h, 0) + VERTICAL_GAP * (sized.length - 1);
			let y = canvasHeight / 2 - totalHeight / 2;

			for (const { child, childDef, w, h } of sized) {
				const centerY = y + h / 2;
				const inputPos: Record<string, Point> = {};
				childDef.inputs.forEach((pin, pi) => {
					const offset = (pi - (childDef.inputs.length - 1) / 2) * PIN_SPACING;
					inputPos[pin.id] = { x, y: centerY + offset };
				});

				const outputPos: Record<string, Point> = {};
				childDef.outputs.forEach((pin, pi) => {
					const offset = (pi - (childDef.outputs.length - 1) / 2) * PIN_SPACING;
					outputPos[pin.id] = { x: x + w, y: centerY + offset };
				});

				children[child.instanceId] = {
					instanceId: child.instanceId,
					definitionId: child.definitionId,
					x,
					y,
					w,
					h,
					inputPos,
					outputPos
				};

				y += h + VERTICAL_GAP;
			}
		});
	}

	const geometry = { selfInputPos, selfOutputPos, children };
	const routes = computeRoutes(def, geometry, canvasWidth, canvasHeight);
	return { ...geometry, routes };
}
