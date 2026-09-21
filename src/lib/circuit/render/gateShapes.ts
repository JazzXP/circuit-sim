// Standard logic-gate schematic symbols. Only classified primitives get a
// distinct shape; composites and unclassified primitives (like the DFF)
// keep the generic labeled-rectangle treatment in canvas-renderer.ts.

export type GateShapeKind = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'GENERIC';

const SHAPE_BY_DEFINITION_ID: Readonly<Record<string, GateShapeKind>> = {
	AND2: 'AND',
	OR2: 'OR',
	NOT: 'NOT',
	NAND2: 'NAND',
	NOR2: 'NOR',
	XOR2: 'XOR',
	XNOR2: 'XNOR',
};

export function gateShapeFor(definitionId: string): GateShapeKind {
	return SHAPE_BY_DEFINITION_ID[definitionId] ?? 'GENERIC';
}

export function isCompactGate(kind: GateShapeKind): boolean {
	return kind !== 'GENERIC';
}

const BUBBLE_RADIUS = 4;

export function drawGateShape(
	ctx: CanvasRenderingContext2D,
	kind: GateShapeKind,
	x: number,
	y: number,
	w: number,
	h: number,
	fill: string,
	stroke: string,
): void {
	ctx.fillStyle = fill;
	ctx.strokeStyle = stroke;
	ctx.lineWidth = 1.5;

	switch (kind) {
		case 'AND': {
			const flat = w * 0.5;
			const rx = w - flat;
			const ry = h / 2;
			const cy = y + h / 2;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + flat, y);
			ctx.ellipse(x + flat, cy, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
			ctx.lineTo(x, y + h);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'NAND': {
			const bodyW = w - BUBBLE_RADIUS * 2;
			const flat = bodyW * 0.5;
			const rx = bodyW - flat;
			const ry = h / 2;
			const cy = y + h / 2;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + flat, y);
			ctx.ellipse(x + flat, cy, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
			ctx.lineTo(x, y + h);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x + bodyW + BUBBLE_RADIUS, cy, BUBBLE_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'OR': {
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.5, x, y + h);
			ctx.quadraticCurveTo(x + w * 0.65, y + h, x + w, y + h * 0.5);
			ctx.quadraticCurveTo(x + w * 0.65, y, x, y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'NOR': {
			// Slightly reduced body width to give the output bubble more clearance from connections
			const bodyW = w - BUBBLE_RADIUS * 3;
			const cy = y + h / 2;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + bodyW * 0.2, y + h * 0.5, x, y + h);
			ctx.quadraticCurveTo(x + bodyW * 0.65, y + h, x + bodyW, y + h * 0.5);
			ctx.quadraticCurveTo(x + bodyW * 0.65, y, x, y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x + bodyW + BUBBLE_RADIUS, cy, BUBBLE_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'XOR': {
			const offset = w * 0.15;
			ctx.beginPath();
			ctx.moveTo(x - offset, y);
			ctx.quadraticCurveTo(x - offset + w * 0.2, y + h * 0.5, x - offset, y + h);
			ctx.lineWidth = 3;
			ctx.stroke();

			ctx.beginPath();
			ctx.lineWidth = 1;
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.5, x, y + h);
			ctx.quadraticCurveTo(x + w * 0.65, y + h, x + w, y + h * 0.5);
			ctx.quadraticCurveTo(x + w * 0.65, y, x, y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'XNOR': {
			// Slightly reduced body width to give the output bubble more clearance from connections
			const bodyW = w - BUBBLE_RADIUS * 3;
			const cy = y + h / 2;
			const offset = bodyW * 0.15;

			ctx.beginPath();
			ctx.moveTo(x - offset, y);
			ctx.quadraticCurveTo(x - offset + bodyW * 0.2, y + h * 0.5, x - offset, y + h);
			ctx.lineWidth = 3;
			ctx.stroke();

			ctx.beginPath();

			ctx.lineWidth = 1;
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(x + bodyW * 0.2, y + h * 0.5, x, y + h);
			ctx.quadraticCurveTo(x + bodyW * 0.65, y + h, x + bodyW, y + h * 0.5);
			ctx.quadraticCurveTo(x + bodyW * 0.65, y, x, y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();

			ctx.beginPath();
			ctx.arc(x + bodyW + BUBBLE_RADIUS, cy, BUBBLE_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'NOT': {
			const bodyW = w - BUBBLE_RADIUS * 2;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x, y + h);
			ctx.lineTo(x + bodyW, y + h / 2);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x + bodyW + BUBBLE_RADIUS, y + h / 2, BUBBLE_RADIUS, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			return;
		}
		case 'GENERIC':
			return; // caller falls back to a rounded rect
	}
}
