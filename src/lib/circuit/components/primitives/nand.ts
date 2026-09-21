import type { PrimitiveDefinition } from '$lib/schemas/circuit';
import { LogicValue } from '#sim/model/component';
import { bit } from '#sim/util/bit';

export const NAND2: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'NAND2',
	name: 'NAND',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'B', name: 'B' },
	],
	outputs: [{ id: 'OUT', name: 'OUT' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) & bit(inputs[1]) ? LogicValue.LOW : LogicValue.HIGH],
		nextState: undefined,
	}),
};
