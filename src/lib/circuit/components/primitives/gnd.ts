import { LogicValue, type PrimitiveDefinition } from '../../sim/model/component';

export const GND: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'GND',
	name: 'GND',
	inputs: [],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: () => ({ outputs: [LogicValue.LOW], nextState: undefined })
};
