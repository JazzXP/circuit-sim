import { LogicValue } from '#sim/model/component';
import { wireColor } from './canvasRenderer';

export interface ScopeTrace {
	label: string;
	samples: readonly { t: number; v: LogicValue }[];
}

export function drawScope(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	traces: readonly ScopeTrace[],
	now: number,
	windowMs: number,
) {
	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = 'rgba(27,30,36,0.88)';
	ctx.fillRect(0, 0, w, h);
	if (traces.length === 0) return;

	const start = now - windowMs;
	const xOf = (t: number) => ((t - start) / windowMs) * w;
	const laneH = h / traces.length;

	// time grid every 500 ms, scrolling with the data
	ctx.strokeStyle = '#2c303a';
	ctx.lineWidth = 1;
	for (let t = Math.ceil(start / 500) * 500; t < now; t += 500) {
		const x = Math.round(xOf(t)) + 0.5;
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, h);
		ctx.stroke();
	}

	traces.forEach((tr, lane) => {
		const top = lane * laneH;
		const yHigh = top + 12,
			yLow = top + laneH - 8,
			yMid = (yHigh + yLow) / 2;
		const levelY = (v: LogicValue) =>
			v === LogicValue.HIGH ? yHigh : v === LogicValue.LOW ? yLow : yMid;

		// lane separator + label + current value
		ctx.strokeStyle = '#3c414d';
		ctx.beginPath();
		ctx.moveTo(0, top + 0.5);
		ctx.lineTo(w, top + 0.5);
		ctx.stroke();
		ctx.fillStyle = '#8b8f99';
		ctx.font = '10px sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(tr.label, 6, top + 11);

		let prevY: number | null = null;
		const s = tr.samples;
		for (let i = 0; i < s.length; i++) {
			const t1 = i + 1 < s.length ? s[i + 1].t : now;
			if (t1 < start) continue;
			const x0 = Math.max(0, xOf(Math.max(s[i].t, start)));
			const x1 = xOf(t1);
			const y = levelY(s[i].v);
			ctx.strokeStyle = wireColor(s[i].v);
			ctx.lineWidth = 2;
			ctx.beginPath();
			if (prevY !== null && prevY !== y) {
				ctx.moveTo(x0, prevY);
				ctx.lineTo(x0, y);
			} else ctx.moveTo(x0, y);
			ctx.lineTo(x1, y);
			ctx.stroke();
			prevY = y;
		}
	});
}
