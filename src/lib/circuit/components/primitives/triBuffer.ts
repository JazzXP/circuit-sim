import { LogicValue } from '#sim/model/component';
import { bit, fromBit } from '#sim/util/bit';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';

// Passes A through to OUT while EN is HIGH; otherwise OUT goes HIGH_Z
// (disconnected), rather than driving LOW. This is the piece that makes a
// shared bus possible: any component that needs to conditionally drive a
// bus line goes through one of these, gated by its own "it's my turn"
// enable signal.
export const TRI_BUFFER: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'TRI_BUFFER',
	name: 'Tri-state buffer',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'EN', name: 'EN' },
	],
	outputs: [{ id: 'OUT', name: 'OUT' }],
	initialState: () => undefined,
	evaluate: (inputs) => {
		const [a, en] = inputs;
		if (en !== LogicValue.HIGH) {
			return { outputs: [LogicValue.HIGH_Z], nextState: undefined };
		}
		return { outputs: [fromBit(bit(a))], nextState: undefined };
	},
};
