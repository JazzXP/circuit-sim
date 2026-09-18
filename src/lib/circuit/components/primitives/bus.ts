import type { PrimitiveDefinition } from '$lib/schemas/circuit';

export const BUS: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'BUS',
	name: 'BUS',
	inputs: [
		{ id: 'A', name: 'A', direction: 'input' },
		{ id: 'B', name: 'B', direction: 'input' },
		{ id: 'C', name: 'C', direction: 'input' },
		{ id: 'D', name: 'D', direction: 'input' },
		{ id: 'E', name: 'E', direction: 'input' },
		{ id: 'F', name: 'F', direction: 'input' },
		{ id: 'G', name: 'G', direction: 'input' },
		{ id: 'H', name: 'H', direction: 'input' },
	],
	outputs: [
		{ id: 'A_OUT', name: 'A_OUT', direction: 'output' },
		{ id: 'B_OUT', name: 'B_OUT', direction: 'output' },
		{ id: 'C_OUT', name: 'C_OUT', direction: 'output' },
		{ id: 'D_OUT', name: 'D_OUT', direction: 'output' },
		{ id: 'E_OUT', name: 'E_OUT', direction: 'output' },
		{ id: 'F_OUT', name: 'F_OUT', direction: 'output' },
		{ id: 'G_OUT', name: 'G_OUT', direction: 'output' },
		{ id: 'H_OUT', name: 'H_OUT', direction: 'output' },
	],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [...inputs],
		nextState: undefined,
	}),
};
