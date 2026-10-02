import { createEeprom } from '#components/primitives/eeprom';

// Control word bits (16-bit). High ROM = bits 15..8, low ROM = bits 7..0.
const HLT = 1 << 15;
const MI = 1 << 14;
const RI = 1 << 13;
const RO = 1 << 12;
const IO = 1 << 11;
const II = 1 << 10;
const AI = 1 << 9;
const AO = 1 << 8;
const EO = 1 << 7;
const SU = 1 << 6;
const BI = 1 << 5;
const OI = 1 << 4;
const CE = 1 << 3;
const CO = 1 << 2;
const J = 1 << 1;
const FI = 1 << 0;

const OP = {
	NOP: 0b0000,
	LDA: 0b0001,
	ADD: 0b0010,
	SUB: 0b0011,
	STA: 0b0100,
	LDI: 0b0101,
	JMP: 0b0110,
	JC: 0b0111,
	JZ: 0b1000,
	OUT: 0b1110,
	HLT: 0b1111,
} as const;

const FETCH = [CO | MI, RO | II | CE];

const MICROCODE: Record<number, readonly number[]> = {
	[OP.NOP]: [],
	[OP.LDA]: [IO | MI, RO | AI],
	[OP.ADD]: [IO | MI, RO | BI, EO | AI | FI],
	[OP.SUB]: [IO | MI, RO | BI, EO | AI | SU | FI],
	[OP.STA]: [IO | MI, AO | RI],
	[OP.LDI]: [IO | AI],
	[OP.JMP]: [IO | J],
	[OP.JC]: [], // conditional, handled in controlWord()
	[OP.JZ]: [], // conditional, handled in controlWord()
	[OP.OUT]: [AO | OI],
	[OP.HLT]: [HLT],
};

// Address layout (both ROMs, matches control.json):
//   A0-A2 = microcode step (T0..T7; only T0..T4 used)
//   A3-A6 = opcode (IR bits 4-7, with A3 = LSB of the opcode)
//   A7    = unused (don't care; tied to GND on both ROMs)
//   A8    = carry flag (CF)
//   A9    = zero flag (ZF)
//   A10   = unused (tied to GND)
function controlWord(address: number): number {
	const step = address & 0b111;
	const opcode = (address >> 3) & 0b1111;
	const carry = (address >> 8) & 1;
	const zero = (address >> 9) & 1;

	let ops = MICROCODE[opcode] ?? [];
	if (opcode === OP.JC && carry) ops = [IO | J];
	if (opcode === OP.JZ && zero) ops = [IO | J];

	const steps = [...FETCH, ...ops];
	return step < steps.length ? steps[step] : 0;
}

export const CONTROL_EEPROM_1 = createEeprom({
	id: 'CONTROL_EEPROM_1',
	name: 'Control ROM (high)',
	addressBits: 11,
	dataBits: 8,
	compute: (addr) => (controlWord(addr) >> 8) & 0xff,
});

export const CONTROL_EEPROM_2 = createEeprom({
	id: 'CONTROL_EEPROM_2',
	name: 'Control ROM (low)',
	addressBits: 11,
	dataBits: 8,
	compute: (addr) => controlWord(addr) & 0xff,
});
