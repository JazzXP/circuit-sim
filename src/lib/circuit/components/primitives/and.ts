import { bit } from '../../sim/util/bit.ts';
import { LogicValue, type PrimitiveDefinition } from '../../sim/model/component.ts';

export const AND2: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'AND2',
	name: 'AND',
	inputs: [
		{ id: 'A', name: 'A', direction: 'input' },
		{ id: 'B', name: 'B', direction: 'input' }
	],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) & bit(inputs[1]) ? LogicValue.HIGH : LogicValue.LOW],
		nextState: undefined
	})
};
