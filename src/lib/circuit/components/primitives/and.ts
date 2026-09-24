import { bit } from '#sim/util/bit';
import { LogicValue } from '#sim/model/component';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';

export const AND2: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'AND2',
	name: 'AND',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'B', name: 'B' },
	],
	outputs: [{ id: 'OUT', name: 'OUT' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) & bit(inputs[1]) ? LogicValue.HIGH : LogicValue.LOW],
		nextState: undefined,
	}),
};

export const AND3: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'AND3',
	name: 'AND',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'B', name: 'B' },
		{ id: 'C', name: 'C' },
	],
	outputs: [{ id: 'OUT', name: 'OUT' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [bit(inputs[0]) & bit(inputs[1] & bit(inputs[2])) ? LogicValue.HIGH : LogicValue.LOW],
		nextState: undefined,
	}),
};

export const AND4: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'AND4',
	name: 'AND',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'B', name: 'B' },
		{ id: 'C', name: 'C' },
		{ id: 'D', name: 'D' },
	],
	outputs: [{ id: 'OUT', name: 'OUT' }],
	initialState: () => undefined,
	evaluate: (inputs) => ({
		outputs: [
			bit(inputs[0]) & bit(inputs[1] & bit(inputs[2]) & bit(inputs[3]))
				? LogicValue.HIGH
				: LogicValue.LOW,
		],
		nextState: undefined,
	}),
};
