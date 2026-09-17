import { LogicValue } from '#sim/model/component';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';

export const GND: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'GND',
	name: 'GND',
	inputs: [],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: () => ({ outputs: [LogicValue.LOW], nextState: undefined }),
};
