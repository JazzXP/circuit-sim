import { LogicValue } from '#sim/model/component';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';
import { bit } from '#sim/util/bit';

export const NOR2: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'NOR2',
	name: 'NOR',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'B', name: 'B' },
	],
	outputs: [{ id: 'OUT', name: 'OUT' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) | bit(inputs[1]) ? LogicValue.LOW : LogicValue.HIGH],
		nextState: undefined,
	}),
};
