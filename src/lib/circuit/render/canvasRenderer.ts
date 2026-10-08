import { LogicValue, getDefinition, inoutPins, resolveDrivers } from '#sim/model/component';
import { wireValue } from '#sim/controller/engine';
import type { Layout, Point } from './layout';
import { gateShapeFor, drawGateShape } from './gateShapes';
import {
	isSevenSegmentDisplay,
	drawSevenSegmentDisplay,
	createSevenSegmentFade,
	type SevenSegmentFade,
} from './sevenSegment';
import type { ComponentInstance, DefinitionLibrary, PinRef } from '$lib/schemas/circuit';
import type { RoutedWire } from './routing';

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
	// Optional 7-segment fade support. The renderer itself is stateless, so the
	// caller owns the per-display fade state (keyed by drill path + instance id)
	// and is told via onAnimating when another frame is needed to finish a fade.
	readonly fadeStates?: Map<string, SevenSegmentFade>;
	readonly pathKey?: string; // identifies which level is being rendered
	readonly now?: number; // timestamp in ms (defaults to performance.now())
	readonly onAnimating?: () => void;

	readonly onProbePin?: (ref: PinRef) => void;
	readonly isProbed?: (ref: PinRef) => boolean;
}

export { wireColor, inoutDisplayValue };

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

function drawPolyline(
	ctx: CanvasRenderingContext2D,
	points: readonly Point[],
	value: LogicValue,
	colourOverride?: string,
) {
	if (points.length < 2) return;
	ctx.strokeStyle = wireColor(value);
	ctx.lineWidth = value === LogicValue.HIGH ? 2.5 : 1.5;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(points[0].x, points[0].y);
	for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
	ctx.stroke();
	if (colourOverride) {
		ctx.beginPath();
		ctx.setLineDash([5, 5]);
		ctx.strokeStyle = colourOverride;
		for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

function drawPinDot(
	ctx: CanvasRenderingContext2D,
	p: Point,
	value: LogicValue,
	colourOverride?: string,
) {
	ctx.fillStyle = colourOverride ?? wireColor(value);
	ctx.beginPath();
	ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
	ctx.fill();
}

// Bidirectional pins are drawn as diamonds (vs. circles for plain in/out
// pins) so they're recognisable at a glance.
function drawInoutPin(ctx: CanvasRenderingContext2D, p: Point, value: LogicValue, size = 5) {
	ctx.fillStyle = wireColor(value);
	ctx.beginPath();
	ctx.moveTo(p.x, p.y - size);
	ctx.lineTo(p.x + size, p.y);
	ctx.lineTo(p.x, p.y + size);
	ctx.lineTo(p.x - size, p.y);
	ctx.closePath();
	ctx.fill();
}

function drawJunctionDot(ctx: CanvasRenderingContext2D, p: Point, value: LogicValue) {
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

// What an inout pin looks like electrically: what the outside is driving in,
// combined with what this instance is driving out. Contention or an
// undriven pin shows up as UNKNOWN / HIGH_Z through the normal resolution.
function inoutDisplayValue(instance: ComponentInstance, pinId: string): LogicValue {
	return resolveDrivers([
		instance.pinValues[pinId] ?? LogicValue.HIGH_Z,
		instance.driveValues?.[pinId] ?? LogicValue.HIGH_Z,
	]);
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

	const addPinRegion = (p: Point, ref: PinRef) => {
		if (!options.onProbePin) return;
		if (options.isProbed?.(ref)) {
			ctx.strokeStyle = COLOR.boxStrokeComposite;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
			ctx.stroke();
		}
		clickRegions.push({
			x: p.x - 7,
			y: p.y - 7,
			w: 14,
			h: 14,
			onClick: () => options.onProbePin!(ref),
		});
	};

	if (def.kind !== 'composite') return clickRegions; // leaf — nothing further to draw

	// Wires are undirected, so a wire's colour is the resolved value of the
	// net it belongs to, not the value of whichever pin `from` happens to name.
	const netColourOf = (wireId: string) => wireValue(lib, instance, wireId);

	// Wires first, so pins/boxes draw on top of the lines meeting them.
	for (const route of layout.routes) {
		drawPolyline(ctx, route.points, netColourOf(route.wireId), route.colour);
	}

	// A junction dot marks a real electrical branch. Branches now attach at
	// wherever they actually meet the shared tree (routing.ts grows a real
	// trunk per wire), not all at one shared coordinate — so every route's
	// own start point is itself a genuine attachment point, and each needs
	// checking, not just the first. Deduped by coordinate in case two
	// branches happen to attach at the exact same cell. Two routes from
	// DIFFERENT wires that happen to cross paths on the canvas never share
	// a wireId, so they correctly never get a dot.
	const routesByWireId = new Map<string, RoutedWire[]>();
	for (const route of layout.routes) {
		const existing = routesByWireId.get(route.wireId);
		if (existing) existing.push(route);
		else routesByWireId.set(route.wireId, [route]);
	}
	for (const routes of routesByWireId.values()) {
		if (routes.length < 2) continue;
		const seen = new Set<string>();
		for (const route of routes) {
			const p = route.points[0];
			const key = `${p.x},${p.y}`;
			if (seen.has(key)) continue;
			seen.add(key);
			drawJunctionDot(ctx, p, netColourOf(route.wireId));
		}
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
		addPinRegion(p, { component: 'self', pinId: pin.id });
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
		addPinRegion(p, { component: 'self', pinId: pin.id });
	});

	// Boundary inouts: a diamond LED that shows the combined state of the
	// pin (what the outside drives in + what this circuit drives out). At the
	// interactive root, a switch lets the person drive the pin from outside,
	// just like an input.
	inoutPins(def).forEach((pin) => {
		const p = layout.selfInoutPos[pin.id];
		if (!p) return;
		const value = inoutDisplayValue(instance, pin.id);
		if (value === LogicValue.HIGH) {
			ctx.shadowColor = COLOR.wireHigh;
			ctx.shadowBlur = 8;
		}
		drawInoutPin(ctx, p, value, 8);
		ctx.shadowBlur = 0;
		ctx.fillStyle = COLOR.textDim;
		ctx.font = '11px sans-serif';
		ctx.textAlign = 'right';
		ctx.fillText(pin.name, p.x - 14, p.y - 8);

		if (options.interactive) {
			const sw = { x: p.x + 12, y: p.y - 10, w: 20, h: 20 };
			ctx.strokeStyle = COLOR.boxStroke;
			roundRect(ctx, sw.x, sw.y, sw.w, sw.h, 6);
			ctx.stroke();
			ctx.fillStyle = wireColor(instance.pinValues[pin.id] ?? LogicValue.HIGH_Z);
			ctx.beginPath();
			ctx.arc(sw.x + sw.w / 2, sw.y + sw.h / 2, 5, 0, Math.PI * 2);
			ctx.fill();
			clickRegions.push({ ...sw, onClick: () => options.onToggleInput(pin.id) });
		}
		addPinRegion(p, { component: 'self', pinId: pin.id });
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
			let fade: SevenSegmentFade | undefined;
			if (options.fadeStates) {
				const key = `${options.pathKey ?? ''}/${child.instanceId}`;
				fade = options.fadeStates.get(key);
				if (!fade) {
					fade = createSevenSegmentFade();
					options.fadeStates.set(key, fade);
				}
			}
			const stillFading = drawSevenSegmentDisplay(
				ctx,
				box.x,
				box.y,
				box.w,
				box.h,
				childInstance.pinValues,
				fade,
				options.now,
			);
			if (stillFading) options.onAnimating?.();
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
			// Names may span multiple lines (real newlines or a literal "\n").
			const lines = (child.name ?? childDef.name).split(/\r?\n|\\n/);
			const lineHeight = 14;
			const firstLineY = box.y + box.h / 2 - ((lines.length - 1) * lineHeight) / 2 + 4;
			const centreX = box.x + box.w / 2;
			lines.forEach((line, i) => {
				ctx.fillText(line, centreX, firstLineY + i * lineHeight);
			});
		}

		childDef.inputs.forEach((pin) => {
			const p = box.inputPos[pin.id];
			drawPinDot(ctx, p, childInstance.pinValues[pin.id]);
			if (pin.id === 'CLK') drawClockMarker(ctx, p, 'right');
			ctx.fillStyle = COLOR.textDim;
			ctx.font = '9px sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(pin.name, p.x - 6, p.y + 3);
			addPinRegion(p, { component: child.instanceId, pinId: pin.id });
		});
		childDef.outputs.forEach((pin) => {
			const p = box.outputPos[pin.id];
			drawPinDot(ctx, p, childInstance.pinValues[pin.id]);
			ctx.fillStyle = COLOR.textDim;
			ctx.font = '9px sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(pin.name, p.x + 6, p.y + 3);
			addPinRegion(p, { component: child.instanceId, pinId: pin.id });
		});
		inoutPins(childDef).forEach((pin) => {
			const p = box.inoutPos[pin.id];
			if (!p) return;
			drawInoutPin(ctx, p, inoutDisplayValue(childInstance, pin.id));
			ctx.fillStyle = COLOR.textDim;
			ctx.font = '9px sans-serif';
			ctx.textAlign = 'left';
			ctx.fillText(pin.name, p.x + 8, p.y + 3);
			addPinRegion(p, { component: child.instanceId, pinId: pin.id });
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
