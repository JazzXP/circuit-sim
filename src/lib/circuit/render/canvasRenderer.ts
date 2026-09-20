import { LogicValue, getDefinition } from '#sim/model/component';
import type { Layout, Point } from './layout';
import { gateShapeFor, drawGateShape } from './gateShapes';
import { isSevenSegmentDisplay, drawSevenSegmentDisplay } from './sevenSegment';
import type { ComponentInstance, PinRef, DefinitionLibrary } from '$lib/schemas/circuit';

export interface ClickRegion {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
	readonly onClick: () => void;
}

export interface RenderOptions {
	readonly interactive: boolean; // only the root level exposes switches
	readonly onToggleInput: (pinId: string) => void;
	readonly onDrillInto: (childInstanceId: string) => void;
}

const COLOR = {
	wireLow: '#4a4e58',
	wireHigh: '#e0a840',
	wireFloating: '#6a5a8a',
	wireContested: '#d9556b',
	boxFill: '#252932',
	boxStroke: '#3c414d',
	boxStrokeComposite: '#6ea8ff',
	text: '#d8dae0',
	textDim: '#8b8f99',
};

function wireColor(v: LogicValue): string {
	if (v === LogicValue.HIGH) return COLOR.wireHigh;
	if (v === LogicValue.HIGH_Z) return COLOR.wireFloating;
	if (v === LogicValue.UNKNOWN) return COLOR.wireContested;
	return COLOR.wireLow;
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function drawPolyline(ctx: CanvasRenderingContext2D, points: readonly Point[], value: LogicValue) {
	if (points.length < 2) return;
	ctx.strokeStyle = wireColor(value);
	ctx.lineWidth = value === LogicValue.HIGH ? 2.5 : 1.5;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(points[0].x, points[0].y);
	for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
	ctx.stroke();
}

function drawPinDot(ctx: CanvasRenderingContext2D, p: Point, value: LogicValue) {
	ctx.fillStyle = wireColor(value);
	ctx.beginPath();
	ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
	ctx.fill();
}

// A small inward-pointing triangle on any pin literally named/id'd "CLK" —
// the standard schematic convention marking an edge-triggered clock input.
function drawClockMarker(ctx: CanvasRenderingContext2D, p: Point, facing: 'right' | 'left') {
	const s = 6;
	const dir = facing === 'right' ? 1 : -1;
	ctx.fillStyle = COLOR.textDim;
	ctx.beginPath();
	ctx.moveTo(p.x, p.y - s / 2);
	ctx.lineTo(p.x, p.y + s / 2);
	ctx.lineTo(p.x + dir * s, p.y);
	ctx.closePath();
	ctx.fill();
}

function resolveValue(instance: ComponentInstance, ref: PinRef): LogicValue {
	if (ref.component === 'self') return instance.pinValues[ref.pinId];
	return instance.children![ref.component].pinValues[ref.pinId];
}

// Renders one level of the drill-down tree: the given instance's own
// boundary pins plus its direct children as boxes, wired per the
// definition's internalWires (using precomputed obstacle-avoiding routes
// from layout.routes). Call again with a deeper instance to render a
// drilled-into level — the function itself has no notion of "depth".
export function renderComposite(
	ctx: CanvasRenderingContext2D,
	lib: DefinitionLibrary,
	instance: ComponentInstance,
	layout: Layout,
	options: RenderOptions,
): ClickRegion[] {
	const def = getDefinition(lib, instance.definitionId);
	const clickRegions: ClickRegion[] = [];
	if (def.kind !== 'composite') return clickRegions; // leaf — nothing further to draw

	// Wires first, so pins/boxes draw on top of the lines meeting them.
	for (const route of layout.routes) {
		drawPolyline(ctx, route.points, resolveValue(instance, route.from));
	}

	// Boundary inputs — with a toggle switch when this is the interactive root.
	def.inputs.forEach((pin) => {
		const p = layout.selfInputPos[pin.id];
		const value = instance.pinValues[pin.id];
		drawPinDot(ctx, p, value);
		if (pin.id === 'CLK') drawClockMarker(ctx, p, 'right');
		ctx.fillStyle = COLOR.textDim;
		ctx.font = '11px sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(pin.name, p.x + 10, p.y - 8);

		if (options.interactive) {
			const sw = { x: p.x - 26, y: p.y - 22, w: 20, h: 20 };
			ctx.strokeStyle = COLOR.boxStroke;
			roundRect(ctx, sw.x, sw.y, sw.w, sw.h, 6);
			ctx.stroke();
			ctx.fillStyle = wireColor(value);
			ctx.beginPath();
			ctx.arc(sw.x + sw.w / 2, sw.y + sw.h / 2, 5, 0, Math.PI * 2);
			ctx.fill();
			clickRegions.push({ ...sw, onClick: () => options.onToggleInput(pin.id) });
		}
	});

	// Boundary outputs, drawn as LEDs.
	def.outputs.forEach((pin) => {
		const p = layout.selfOutputPos[pin.id];
		const value = instance.pinValues[pin.id];
		ctx.fillStyle = wireColor(value);
		if (value === LogicValue.HIGH) {
			ctx.shadowColor = COLOR.wireHigh;
			ctx.shadowBlur = 8;
		}
		ctx.beginPath();
		ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
		ctx.fillStyle = COLOR.textDim;
		ctx.font = '11px sans-serif';
		ctx.textAlign = 'right';
		ctx.fillText(pin.name, p.x - 12, p.y - 8);
	});

	// Child boxes — a proper gate symbol for classified primitives, a
	// labeled rounded rect (IC-block style) for composites and anything else.
	for (const child of def.children) {
		const box = layout.children[child.instanceId];
		const childInstance = instance.children![child.instanceId];
		const childDef = getDefinition(lib, child.definitionId);
		const isComposite = childDef.kind === 'composite';
		const isDisplay = childDef.kind === 'primitive' && isSevenSegmentDisplay(childDef.id);
		const shape = childDef.kind === 'primitive' ? gateShapeFor(childDef.id) : 'GENERIC';

		if (isDisplay) {
			drawSevenSegmentDisplay(ctx, box.x, box.y, box.w, box.h, childInstance.pinValues);
		} else if (shape !== 'GENERIC') {
			drawGateShape(ctx, shape, box.x, box.y, box.w, box.h, COLOR.boxFill, COLOR.boxStroke);
		} else {
			ctx.fillStyle = COLOR.boxFill;
			ctx.strokeStyle = isComposite ? COLOR.boxStrokeComposite : COLOR.boxStroke;
			ctx.lineWidth = 1;
			roundRect(ctx, box.x, box.y, box.w, box.h, 8);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = COLOR.text;
			ctx.font = '500 12px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(child.name ?? childDef.name, box.x + box.w / 2, box.y + box.h / 2 + 4);
		}

		childDef.inputs.forEach((pin) => {
			const p = box.inputPos[pin.id];
			drawPinDot(ctx, p, childInstance.pinValues[pin.id]);
			if (pin.id === 'CLK') drawClockMarker(ctx, p, 'right');
			ctx.fillStyle = COLOR.textDim;
			ctx.font = '9px sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(pin.name, p.x - 6, p.y + 3);
		});
		childDef.outputs.forEach((pin) => {
			const p = box.outputPos[pin.id];
			drawPinDot(ctx, p, childInstance.pinValues[pin.id]);
			ctx.fillStyle = COLOR.textDim;
			ctx.font = '9px sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(pin.name, p.x + 6, p.y + 3);
		});

		if (isComposite) {
			clickRegions.push({
				x: box.x,
				y: box.y,
				w: box.w,
				h: box.h,
				onClick: () => options.onDrillInto(child.instanceId),
			});
		}
	}

	return clickRegions;
}
