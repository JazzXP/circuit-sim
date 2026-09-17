// Gated D latch: transparent (Q follows D) while EN is high, holds while EN
// is low. Built by converting D/EN into S'/R' and feeding an SR_LATCH — note

import type { CompositeDefinition } from '$lib/schemas/circuit';

// this nests a composite inside a composite.
export const D_LATCH: CompositeDefinition = {
	kind: 'composite',
	id: 'D_LATCH',
	name: 'D latch (gated)',
	inputs: [
		{ id: 'D', name: 'D', direction: 'input' },
		{ id: 'EN', name: 'EN', direction: 'input' },
	],
	outputs: [
		{ id: 'Q', name: 'Q', direction: 'output' },
		{ id: 'Q_n', name: "Q'", direction: 'output' },
	],
	children: [
		{ instanceId: 'notD', definitionId: 'NAND2' }, // wired as inverter: A and B both = D
		{ instanceId: 'nS', definitionId: 'NAND2' }, // S' = NAND(D, EN)
		{ instanceId: 'nR', definitionId: 'NAND2' }, // R' = NAND(NOT D, EN)
		{ instanceId: 'latch', definitionId: 'SR_LATCH' },
	],
	internalWires: [
		{
			id: 'w1',
			from: { component: 'self', pinId: 'D' },
			to: [
				{ component: 'notD', pinId: 'A' },
				{ component: 'notD', pinId: 'B' },
				{ component: 'nS', pinId: 'A' },
			],
		},
		{
			id: 'w2',
			from: { component: 'self', pinId: 'EN' },
			to: [
				{ component: 'nS', pinId: 'B' },
				{ component: 'nR', pinId: 'B' },
			],
		},
		{ id: 'w3', from: { component: 'notD', pinId: 'OUT' }, to: [{ component: 'nR', pinId: 'A' }] },
		{
			id: 'w4',
			from: { component: 'nS', pinId: 'OUT' },
			to: [{ component: 'latch', pinId: 'S_n' }],
		},
		{
			id: 'w5',
			from: { component: 'nR', pinId: 'OUT' },
			to: [{ component: 'latch', pinId: 'R_n' }],
		},
		{ id: 'w6', from: { component: 'latch', pinId: 'Q' }, to: [{ component: 'self', pinId: 'Q' }] },
		{
			id: 'w7',
			from: { component: 'latch', pinId: 'Q_n' },
			to: [{ component: 'self', pinId: 'Q_n' }],
		},
	],
};
