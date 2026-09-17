import { LogicValue } from '#sim/model/component';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';

// The one deliberate exception to "primitives are pure functions of their
// inputs" in this whole codebase: a clock is fundamentally a real-time
// oscillator, so its evaluate() reads Date.now(). It's still deterministic
// given the same wall-clock reading and the same prevState — it's just that
// "wall-clock reading" is an implicit extra input, exactly like it would be
// for a real 555-timer-based clock module. Every other primitive in this
// project should NOT do this; this one is special because the thing it's
// modeling is genuinely time-based, not logic-based.
//
// EN is a normal pin — wire it or toggle it like a switch to run/halt.
// periodMs lives in primitiveState rather than as a pin, since it's a
// hardware "knob" (like a potentiometer), not a logic-level signal the
// rest of the circuit reacts to. Change it via updateInstanceStateAtPath
// (sim/model/tree.ts), not through the wiring/propagation system.
export interface ClockState {
	readonly output: LogicValue;
	readonly lastToggleAt: number; // ms, from Date.now()
	readonly periodMs: number; // one full HIGH+LOW cycle; toggles every periodMs / 2
}

export const DEFAULT_CLOCK_PERIOD_MS = 1000;

export const CLOCK: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'CLOCK',
	name: 'Clock',
	inputs: [{ id: 'EN', name: 'EN', direction: 'input' }],
	outputs: [{ id: 'CLK', name: 'CLK', direction: 'output' }],
	initialState: (): ClockState => ({
		output: LogicValue.LOW,
		lastToggleAt: Date.now(),
		periodMs: DEFAULT_CLOCK_PERIOD_MS,
	}),
	evaluate: (inputs, prevState) => {
		const state = prevState as ClockState;
		const [en] = inputs;

		if (en !== LogicValue.HIGH) {
			// Halted: hold LOW, and reset the phase so it resumes cleanly from a
			// fresh LOW edge next time it's re-enabled instead of picking up
			// mid-cycle.
			const nextState: ClockState = { ...state, output: LogicValue.LOW, lastToggleAt: Date.now() };
			return { outputs: [LogicValue.LOW], nextState };
		}

		const now = Date.now();
		const halfPeriod = state.periodMs / 2;
		if (now - state.lastToggleAt >= halfPeriod) {
			const nextOutput = state.output === LogicValue.HIGH ? LogicValue.LOW : LogicValue.HIGH;
			const nextState: ClockState = { ...state, output: nextOutput, lastToggleAt: now };
			return { outputs: [nextOutput], nextState };
		}

		return { outputs: [state.output], nextState: state };
	},
};
