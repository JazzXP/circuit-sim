import { LogicValue, type PrimitiveDefinition } from '$lib/circuit/sim/model/component';
import { bit } from '../../sim/util/bit.ts';

export const OR2: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'OR2',
	name: 'OR',
	inputs: [
		{ id: 'A', name: 'A', direction: 'input' },
		{ id: 'B', name: 'B', direction: 'input' }
	],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) | bit(inputs[1]) ? LogicValue.HIGH : LogicValue.LOW],
		nextState: undefined
	})
};
