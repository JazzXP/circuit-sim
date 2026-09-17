import type { PrimitiveDefinition } from '$lib/schemas/circuit';
import { LogicValue } from '#sim/model/component';
import { bit } from '#sim/util/bit';

export const NAND2: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'NAND2',
	name: 'NAND',
	inputs: [
		{ id: 'A', name: 'A', direction: 'input' },
		{ id: 'B', name: 'B', direction: 'input' },
	],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) & bit(inputs[1]) ? LogicValue.LOW : LogicValue.HIGH],
		nextState: undefined,
	}),
};
