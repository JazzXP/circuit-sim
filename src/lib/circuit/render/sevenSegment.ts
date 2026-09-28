import { LogicValue } from '#sim/model/component';
import type { Point } from './layout';

export function isSevenSegmentDisplay(definitionId: string): boolean {
	return definitionId === 'SEVEN_SEGMENT_DISPLAY';
}

const SEGMENT_ON = '#ff5a3c';
const SEGMENT_OFF = '#3a2420'; // dim, but still visible — like a real unlit LED segment
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SEGMENT_ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp', 'en'] as const;

// Draws the classic 7-segment glyph filling the given box, with each
// segment colored by whether its corresponding pin is currently HIGH.
// pinValues is expected to have keys "a" through "g" (see
// components/primitives/seven-segment-display.ts).
export function drawSevenSegmentDisplay(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	pinValues: Readonly<Record<string, LogicValue>>,
): void {
	const margin = 10;
	const x0 = x + margin;
	const x1 = x + w - margin;
	const y0 = y + margin;
	const y1 = y + h - margin;
	const midY = (y0 + y1) / 2;
	const t = Math.max(4, Math.min(10, (x1 - x0) * 0.22)); // segment thickness

	const isOn = (seg: (typeof SEGMENT_ORDER)[number]) =>
		pinValues['en'] !== LogicValue.HIGH && pinValues[seg] === LogicValue.HIGH;
	const fillRect = (rx: number, ry: number, rw: number, rh: number, on: boolean) => {
		if (rw <= 0 || rh <= 0) return;
		ctx.fillStyle = on ? SEGMENT_ON : SEGMENT_OFF;
		ctx.fillRect(rx, ry, rw, rh);
	};
	const drawDot = (p: Point, size: number, isOn: boolean) => {
		ctx.fillStyle = isOn ? SEGMENT_ON : SEGMENT_OFF;
		ctx.beginPath();
		ctx.arc(p.x - size / 2, p.y - size / 2, size, 0, Math.PI * 2);
		ctx.fill();
	};

	// Background plate, like the dark PCB behind a real 7-seg display.
	ctx.fillStyle = '#100b0a';
	ctx.fillRect(x, y, w, h);

	const hSpan = x1 - x0 - 2 * t;

	fillRect(x0 + t, y0, hSpan, t, isOn('a')); // top
	fillRect(x0 + t, midY - t / 2, hSpan, t, isOn('g')); // middle
	fillRect(x0 + t, y1 - t, hSpan, t, isOn('d')); // bottom

	const topVSpan = midY - y0 - t * 1.5;
	const botVSpan = y1 - midY - t * 1.5;

	fillRect(x0, y0 + t, t, topVSpan, isOn('f')); // top-left
	fillRect(x1 - t, y0 + t, t, topVSpan, isOn('b')); // top-right
	fillRect(x0, midY + t / 2, t, botVSpan, isOn('e')); // bottom-left
	fillRect(x1 - t, midY + t / 2, t, botVSpan, isOn('c')); // bottom-right

	drawDot(
		{ x: x + margin + w - margin - t / 2, y: y + margin + h - margin - t },
		t / 2,
		isOn('dp'),
	);
}
