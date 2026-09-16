import { LogicValue, type PrimitiveDefinition } from '$lib/circuit/sim/model/component';
import { bit } from '../../sim/util/bit.ts';

export const NOT: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'NOT',
	name: 'NOT',
	inputs: [{ id: 'A', name: 'A', direction: 'input' }],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) ? LogicValue.LOW : LogicValue.HIGH],
		nextState: undefined
	})
};
