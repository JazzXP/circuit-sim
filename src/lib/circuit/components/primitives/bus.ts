import { LogicValue } from '#sim/model/component';
import { displayValue } from '#sim/util/bit';
import type { PrimitiveDefinition, PinSpec } from '$lib/schemas/circuit';

// A shared bus, one bit wide. The normal wire model (one source, many
// listeners) can't represent "several components that might each drive the
// same line" — a bus needs the opposite: many possible sources, resolved
// into one line. This factory produces exactly that: an N-input primitive
// where each input is expected to come from a TRI_BUFFER (or anything else
// that can go HIGH_Z), and the output is whichever single driver is
// actually active.
//
// Build a wider bus by instantiating one of these per bit and wiring the
// corresponding bit from each driver into it — same approach as every
// other multi-bit thing in this project (EEPROM address/data lines,
// COUNTER_4BIT's bits), rather than a single component with dozens of pins.
//
// IMPORTANT: evaluate() never throws, even when drivers disagree. The
// engine updates gates one at a time, not simultaneously, so a bus can
// legitimately see a momentary, transient disagreement between its inputs
// while an upstream change is still propagating — even in a perfectly
// correctly-wired circuit. Throwing on that would produce false positives
// constantly. Instead: disagreement resolves to LogicValue.UNKNOWN
// (matching how hardware description language simulators represent
// contested/indeterminate signals as 'X'), and checkState below provides
// a way to detect PERSISTENT contention after a full event has settled —
// see sim/model/diagnostics.ts.
export interface BusConfig {
	readonly id: string;
	readonly name: string;
	readonly driverCount: number;
}

function findContention(values: readonly LogicValue[]): {
	first: { index: number; value: LogicValue };
	conflict: { index: number; value: LogicValue };
} | null {
	const active = values
		.map((value, index) => ({ index, value }))
		.filter((d) => d.value === LogicValue.HIGH || d.value === LogicValue.LOW);
	if (active.length < 2) return null;
	const conflict = active.find((d) => d.value !== active[0].value);
	return conflict ? { first: active[0], conflict } : null;
}

export function createBus(config: BusConfig): PrimitiveDefinition {
	const { id, name, driverCount } = config;

	const inputs: PinSpec[] = Array.from({ length: driverCount }, (_, i) => ({
		id: `D${i}`,
		name: `D${i}`,
	}));

	return {
		kind: 'primitive',
		id,
		name,
		inputs,
		outputs: [{ id: 'OUT', name: 'OUT' }],
		initialState: () => undefined,
		evaluate: (values) => {
			const active = values.filter((v) => v === LogicValue.HIGH || v === LogicValue.LOW);
			if (active.length === 0) {
				return { outputs: [LogicValue.HIGH_Z], nextState: undefined }; // nothing driving — bus floats
			}
			const allAgree = active.every((v) => v === active[0]);
			return { outputs: [allAgree ? active[0] : LogicValue.UNKNOWN], nextState: undefined };
		},
		checkState: (values) => {
			const contention = findContention(values as unknown as LogicValue[]);
			if (!contention) return null;
			return `Bus contention on "${id}": D${contention.first.index}=${displayValue(contention.first.value)} conflicts with D${contention.conflict.index}=${displayValue(contention.conflict.value)}`;
		},
	};
}
