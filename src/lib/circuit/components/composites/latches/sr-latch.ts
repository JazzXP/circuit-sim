// Cross-coupled NAND latch — the cyclic core every gate-level flip-flop is
// built on. S_n / R_n are active-low (NAND convention): pulsing S_n low sets

import type { CompositeDefinition } from '$lib/schemas/circuit';

// Q=1, pulsing R_n low resets Q=0, holding both high latches the last value.
export const SR_LATCH: CompositeDefinition = {
	kind: 'composite',
	id: 'SR_LATCH',
	name: 'SR latch (NAND)',
	inputs: [
		{ id: 'S_n', name: "S'", direction: 'input' },
		{ id: 'R_n', name: "R'", direction: 'input' },
	],
	outputs: [
		{ id: 'Q', name: 'Q', direction: 'output' },
		{ id: 'Q_n', name: "Q'", direction: 'output' },
	],
	children: [
		{ instanceId: 'nandA', definitionId: 'NAND2' },
		{ instanceId: 'nandB', definitionId: 'NAND2' },
	],
	internalWires: [
		{
			id: 'w1',
			from: { component: 'self', pinId: 'S_n' },
			to: [{ component: 'nandA', pinId: 'A' }],
		},
		{
			id: 'w2',
			from: { component: 'self', pinId: 'R_n' },
			to: [{ component: 'nandB', pinId: 'A' }],
		},
		{
			id: 'w3',
			from: { component: 'nandA', pinId: 'OUT' },
			to: [
				{ component: 'self', pinId: 'Q' },
				{ component: 'nandB', pinId: 'B' },
			],
		},
		{
			id: 'w4',
			from: { component: 'nandB', pinId: 'OUT' },
			to: [
				{ component: 'self', pinId: 'Q_n' },
				{ component: 'nandA', pinId: 'B' },
			],
		},
	],
};
