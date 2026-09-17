import { LogicValue } from '#sim/model/component';
import type { PinSpec, PrimitiveDefinition } from '$lib/schemas/circuit';

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
export interface EepromConfig {
	readonly id: string;
	readonly name: string;
	readonly addressBits: number;
	readonly dataBits: number;
	// Provide exactly one of these. `data` is a literal table (length must be
	// 2^addressBits); `compute` generates one lazily from a formula — handy
	// once addressBits gets large enough that writing out the table by hand
	// isn't practical (e.g. a 256-entry microcode ROM).
	readonly data?: readonly number[];
	readonly compute?: (address: number) => number;
}

export function createEeprom(config: EepromConfig): PrimitiveDefinition {
	const { id, name, addressBits, dataBits } = config;
	const size = 1 << addressBits;

	const table = buildTable(config, size);
	validateTable(id, table, size, dataBits);

	const addressPins: PinSpec[] = Array.from({ length: addressBits }, (_, i) => ({
		id: `A${i}`,
		name: `A${i}`,
		direction: 'input' as const,
	}));
	const oePin: PinSpec = { id: 'OE_n', name: "OE'", direction: 'input' };
	const dataPins: PinSpec[] = Array.from({ length: dataBits }, (_, i) => ({
		id: `D${i}`,
		name: `D${i}`,
		direction: 'output' as const,
	}));

	return {
		kind: 'primitive',
		id,
		name,
		inputs: [...addressPins, oePin],
		outputs: dataPins,
		initialState: () => undefined,
		evaluate: (inputs) => {
			const addressInputs = inputs.slice(0, addressBits);
			const oeN = inputs[addressBits];

			if (oeN !== LogicValue.LOW) {
				// Not asserted (LOW is the active level) — outputs disconnected.
				return { outputs: new Array(dataBits).fill(LogicValue.HIGH_Z), nextState: undefined };
			}

			let address = 0;
			addressInputs.forEach((v, i) => {
				if (v === LogicValue.HIGH) address |= 1 << i;
			});

			const value = table[address];
			const outputs: LogicValue[] = [];
			for (let i = 0; i < dataBits; i++) {
				outputs.push((value >> i) & 1 ? LogicValue.HIGH : LogicValue.LOW);
			}
			return { outputs, nextState: undefined };
		},
	};
}

function buildTable(config: EepromConfig, size: number): readonly number[] {
	if (config.data && config.compute) {
		throw new Error(`EEPROM "${config.id}": provide either "data" or "compute", not both`);
	}
	if (config.data) return config.data;
	if (config.compute) return Array.from({ length: size }, (_, addr) => config.compute!(addr));
	throw new Error(`EEPROM "${config.id}": must provide either "data" or "compute"`);
}

function validateTable(id: string, table: readonly number[], size: number, dataBits: number): void {
	if (table.length !== size) {
		throw new Error(
			`EEPROM "${id}": table has ${table.length} entries, expected ${size} (2^addressBits)`,
		);
	}
	const max = (1 << dataBits) - 1;
	table.forEach((value, addr) => {
		if (!Number.isInteger(value) || value < 0 || value > max) {
			throw new Error(
				`EEPROM "${id}": value ${value} at address ${addr} doesn't fit in ${dataBits} bits (0-${max})`,
			);
		}
	});
}
