import type { PrimitiveDefinition } from '$lib/schemas/circuit';
import { LogicValue } from '#sim/model/component';

// Rising-edge D flip-flop. State remembers the last clock level so it can
// detect an edge rather than just reacting to CLK being HIGH.
interface DffState {
	readonly lastClock: LogicValue;
	readonly storedBit: LogicValue;
}

export const DFF: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'DFF',
	name: 'D flip-flop',
	inputs: [
		{ id: 'D', name: 'D' },
		{ id: 'CLK', name: 'CLK' },
	],
	outputs: [
		{ id: 'Q', name: 'Q' },
		{ id: 'NQ', name: "Q'" },
	],
	initialState: (): DffState => ({ lastClock: LogicValue.LOW, storedBit: LogicValue.LOW }),
	evaluate: (inputs, prevState) => {
		const state = prevState as DffState;
		const [d, clk] = inputs;
		const risingEdge = state.lastClock === LogicValue.LOW && clk === LogicValue.HIGH;
		const storedBit = risingEdge ? d : state.storedBit;

		const nextState: DffState = { lastClock: clk, storedBit };
		return {
			outputs: [storedBit, storedBit === LogicValue.HIGH ? LogicValue.LOW : LogicValue.HIGH],
			nextState,
		};
	},
};
