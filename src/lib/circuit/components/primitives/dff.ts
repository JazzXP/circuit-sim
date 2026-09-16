import { LogicValue, type PrimitiveDefinition } from '../../sim/model/component.ts';

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
		{ id: 'D', name: 'D', direction: 'input' },
		{ id: 'CLK', name: 'CLK', direction: 'input' }
	],
	outputs: [
		{ id: 'Q', name: 'Q', direction: 'output' },
		{ id: 'NQ', name: "Q'", direction: 'output' }
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
			nextState
		};
	}
};
