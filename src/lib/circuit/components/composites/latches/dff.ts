// Master-slave DFF: master latch is transparent while CLK is low (captures
// D), slave is transparent while CLK is high (copies master out to Q). The
// net effect only ever changes Q on a rising edge — with zero hidden state,

import type { CompositeDefinition } from '$lib/schemas/circuit';

// purely from two D_LATCHes and an inverter.
export const DFF_GATES: CompositeDefinition = {
	kind: 'composite',
	id: 'DFF_GATES',
	name: 'D flip-flop (gates)',
	inputs: [
		{ id: 'D', name: 'D', direction: 'input' },
		{ id: 'CLK', name: 'CLK', direction: 'input' },
	],
	outputs: [
		{ id: 'Q', name: 'Q', direction: 'output' },
		{ id: 'NQ', name: "Q'", direction: 'output' },
	],
	children: [
		{ instanceId: 'notClk', definitionId: 'NAND2' },
		{ instanceId: 'master', definitionId: 'D_LATCH' },
		{ instanceId: 'slave', definitionId: 'D_LATCH' },
	],
	internalWires: [
		{
			from: { component: 'self', pinId: 'D' },
			to: [{ component: 'master', pinId: 'D' }],
		},
		{
			from: { component: 'self', pinId: 'CLK' },
			to: [
				{ component: 'notClk', pinId: 'A' },
				{ component: 'notClk', pinId: 'B' },
				{ component: 'slave', pinId: 'EN' },
			],
		},
		{
			from: { component: 'notClk', pinId: 'OUT' },
			to: [{ component: 'master', pinId: 'EN' }],
		},
		{
			from: { component: 'master', pinId: 'Q' },
			to: [{ component: 'slave', pinId: 'D' }],
		},
		{ from: { component: 'slave', pinId: 'Q' }, to: [{ component: 'self', pinId: 'Q' }] },
		{
			from: { component: 'slave', pinId: 'Q_n' },
			to: [{ component: 'self', pinId: 'NQ' }],
		},
	],
};
