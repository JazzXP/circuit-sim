import { LogicValue } from '#sim/model/component';
import type { Point } from './layout';

export function isSevenSegmentDisplay(definitionId: string): boolean {
	return definitionId === 'SEVEN_SEGMENT_DISPLAY';
}

const ON_RGB = [0xff, 0x5a, 0x3c] as const;
const OFF_RGB = [0x3a, 0x24, 0x20] as const; // dim, but still visible — like a real unlit LED segment
const FADE_TAU_MS = 200; // smaller = snappier; ~40-100 feels like a real LED
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SEGMENT_ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp', 'en'] as const;

// Per-display fade state. Keep one of these per display instance so segment
// brightness persists between frames.
export interface SevenSegmentFade {
	levels: Record<string, number>; // 0 = off colour, 1 = on colour
	lastTime: number | null;
}

export function createSevenSegmentFade(): SevenSegmentFade {
	return { levels: {}, lastTime: null };
}

function mixColor(level: number): string {
	const c = ON_RGB.map((on, i) => Math.round(OFF_RGB[i] + (on - OFF_RGB[i]) * level));
	return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Draws the classic 7-segment glyph filling the given box, with each
// segment colored by whether its corresponding pin is currently HIGH.
// pinValues is expected to have keys "a" through "g" (see
// components/primitives/seven-segment-display.ts).
//
// If `fade` is supplied, segments light instantly and fade out smoothly when
// their pin goes LOW. If it is omitted, segments switch instantly (the
// original behaviour), so existing callers keep working.
//
// Returns true while any segment is still fading, so the caller can keep
// scheduling redraws until the animation settles.
export function drawSevenSegmentDisplay(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	pinValues: Readonly<Record<string, LogicValue>>,
	fade?: SevenSegmentFade,
	now: number = performance.now(),
): boolean {
	const margin = 10;
	const x0 = x + margin;
	const x1 = x + w - margin;
	const y0 = y + margin;
	const y1 = y + h - margin;
	const midY = (y0 + y1) / 2;
	const t = Math.max(4, Math.min(10, (x1 - x0) * 0.22)); // segment thickness

	// Without caller-provided state, use a throwaway one: levels start at their
	// target, so nothing fades and nothing is retained between frames.
	const state = fade ?? createSevenSegmentFade();
	const dt = state.lastTime === null ? 0 : Math.max(0, now - state.lastTime);
	state.lastTime = now;
	const decay = Math.exp(-dt / FADE_TAU_MS);
	let animating = false;

	const level = (seg: (typeof SEGMENT_ORDER)[number]): number => {
		const target =
			pinValues['en'] !== LogicValue.HIGH && pinValues[seg] === LogicValue.HIGH ? 1 : 0;
		let cur = state.levels[seg] ?? target;
		if (target > cur)
			cur = target; // instant on
		else cur = cur * decay; // exponential fall-off
		if (cur < 0.01) cur = 0; // snap so we stop animating
		if (cur !== target) animating = true;
		state.levels[seg] = cur;
		return cur;
	};
	const fillRect = (rx: number, ry: number, rw: number, rh: number, lvl: number) => {
		if (rw <= 0 || rh <= 0) return;
		ctx.fillStyle = mixColor(lvl);
		ctx.fillRect(rx, ry, rw, rh);
	};
	const drawDot = (p: Point, size: number, lvl: number) => {
		ctx.fillStyle = mixColor(lvl);
		ctx.beginPath();
		ctx.arc(p.x - size / 2, p.y - size / 2, size, 0, Math.PI * 2);
		ctx.fill();
	};

	// Background plate, like the dark PCB behind a real 7-seg display.
	ctx.fillStyle = '#100b0a';
	ctx.fillRect(x, y, w, h);

	const hSpan = x1 - x0 - 2 * t;

	fillRect(x0 + t, y0, hSpan, t, level('a')); // top
	fillRect(x0 + t, midY - t / 2, hSpan, t, level('g')); // middle
	fillRect(x0 + t, y1 - t, hSpan, t, level('d')); // bottom

	const topVSpan = midY - y0 - t * 1.5;
	const botVSpan = y1 - midY - t * 1.5;

	fillRect(x0, y0 + t, t, topVSpan, level('f')); // top-left
	fillRect(x1 - t, y0 + t, t, topVSpan, level('b')); // top-right
	fillRect(x0, midY + t / 2, t, botVSpan, level('e')); // bottom-left
	fillRect(x1 - t, midY + t / 2, t, botVSpan, level('c')); // bottom-right

	drawDot(
		{ x: x + margin + w - margin - t / 2, y: y + margin + h - margin - t },
		t / 2,
		level('dp'),
	);

	return animating;
}
