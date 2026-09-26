import { LogicValue } from '#sim/model/component';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';

// EEPROMs aren't one component — each one's whole identity IS its contents
// (a microcode ROM, a 7-segment decoder, an ALU flags table are all "an
// EEPROM" but obviously different components). So this is a factory:
// createEeprom(config) closes over a specific lookup table and returns a
// distinct PrimitiveDefinition with that data baked in — register as many
// as you need, each under its own id.
//
// Pins: A0..A{addressBits-1} address the table (A0 = LSB), D0..D{dataBits-1}
// carry the addressed value (D0 = LSB), and OE_n is an active-low output
// enable — pull it LOW to drive the data pins, leave it HIGH and the
// outputs go to HIGH_Z (tri-stated), same as a real EEPROM's /OE pin. This
// matters once you put several ROMs/registers on a shared bus.
export interface TimerConfig {
	readonly id: string;
	readonly name: string;
	readonly time: number;
}

export interface TimerState {
	readonly output: LogicValue;
	readonly lastToggleAt: number; // ms, from Date.now()
	readonly periodMs: number; // one full HIGH+LOW cycle; toggles every periodMs / 2
}

export function createTimer(config: TimerConfig): PrimitiveDefinition {
	const { id, name, time } = config;
	return {
		kind: 'primitive',
		id,
		name,
		inputs: [{ id: 'EN', name: 'EN' }],
		outputs: [{ id: 'CLK', name: 'CLK' }],
		initialState: (): TimerState => ({
			output: LogicValue.LOW,
			lastToggleAt: Date.now(),
			periodMs: time,
		}),
		evaluate: (inputs, prevState) => {
			const state = prevState as TimerState;
			const [en] = inputs;

			if (en !== LogicValue.HIGH) {
				// Halted: hold LOW, and reset the phase so it resumes cleanly from a
				// fresh LOW edge next time it's re-enabled instead of picking up
				// mid-cycle.
				const nextState: TimerState = {
					...state,
					output: LogicValue.LOW,
					lastToggleAt: Date.now(),
				};
				return { outputs: [LogicValue.LOW], nextState };
			}

			const now = Date.now();
			const halfPeriod = state.periodMs / 2;
			if (now - state.lastToggleAt >= halfPeriod) {
				const nextOutput = state.output === LogicValue.HIGH ? LogicValue.LOW : LogicValue.HIGH;
				const nextState: TimerState = { ...state, output: nextOutput, lastToggleAt: now };
				return { outputs: [nextOutput], nextState };
			}

			return { outputs: [state.output], nextState: state };
		},
	};
}
