import { createEeprom } from '#components/primitives/eeprom';

// Program ROM for PROGRAM_LOADER.
//
// Address: A0-A3 = byte index (the loader's counter, 0..15 = RAM address)
//          A4-A6 = program number (PSEL0..PSEL2, 8 programs)
//          A7-A10 = unused (tied to GND)
// Data:    D0..D7 = byte written to RAM (RAM_SET_0..RAM_SET_7)
//
// Instruction byte = opcode << 4 | operand (a RAM address, or a 4-bit value for LDI).

const OP = {
	NOP: 0x0,
	LDA: 0x1,
	ADD: 0x2,
	SUB: 0x3,
	STA: 0x4,
	LDI: 0x5,
	JMP: 0x6,
	JC: 0x7,
	JZ: 0x8,
	OUT: 0xe,
	HLT: 0xf,
} as const;

type Mnemonic = keyof typeof OP;
type Line = readonly [Mnemonic] | readonly [Mnemonic, number];

interface Program {
	readonly name: string;
	readonly code: readonly Line[]; // placed at address 0..
	readonly data?: Readonly<Record<number, number>>; // address -> byte
}

const PROGRAMS: readonly Program[] = [
	// 0: displays 8
	{
		name: 'Add: 5 + 3',
		code: [['LDI', 5], ['ADD', 15], ['OUT'], ['HLT']],
		data: { 15: 3 },
	},
	// 1: displays 0, 1, 2, ... 255, 0, 1 ... forever
	{
		name: 'Count up',
		code: [['OUT'], ['ADD', 15], ['JMP', 0]],
		data: { 15: 1 },
	},
	// 2: displays 10, 9, 8 ... 1, 0 then halts
	{
		name: 'Count down from 10',
		code: [['LDA', 15], ['OUT'], ['SUB', 14], ['JZ', 5], ['JMP', 1], ['OUT'], ['HLT']],
		data: { 14: 1, 15: 10 },
	},
	// 3: displays 0, 1, 1, 2, 3, 5, 8, 13 ... 233 then wraps and carries on
	{
		name: 'Fibonacci',
		code: [
			['LDI', 1],
			['STA', 14],
			['LDI', 0],
			['OUT'],
			['ADD', 14],
			['STA', 15],
			['LDA', 14],
			['STA', 13],
			['LDA', 15],
			['STA', 14],
			['LDA', 13],
			['JMP', 3],
		],
	},
	// 4: displays 42 (6 x 7 by repeated addition) then halts
	{
		name: 'Multiply 6 x 7',
		code: [
			['LDA', 12],
			['ADD', 15],
			['STA', 12],
			['LDA', 14],
			['SUB', 13],
			['STA', 14],
			['JZ', 8],
			['JMP', 0],
			['LDA', 12],
			['OUT'],
			['HLT'],
		],
		data: { 12: 0, 13: 1, 14: 6, 15: 7 },
	},
	// 5: displays 0, 17, 34 ... 255 then halts when the next add carries (tests JC)
	{
		name: 'Count by 17 to 255',
		code: [['OUT'], ['ADD', 15], ['JC', 4], ['JMP', 0], ['HLT']],
		data: { 15: 17 },
	},
	// 6: 10 - 15 = 251 (-5 with SIGNED on), then halts
	{
		name: 'Subtract: 10 - 15',
		code: [['LDI', 10], ['SUB', 15], ['OUT'], ['HLT']],
		data: { 15: 15 },
	},
	// 7: alternates 85 and 170 forever
	{
		name: 'Alternate 85 / 170',
		code: [['LDA', 14], ['OUT'], ['LDA', 15], ['OUT'], ['JMP', 0]],
		data: { 14: 0x55, 15: 0xaa },
	},
];

const DATA: number[] = new Array(2 ** 11).fill(0);
PROGRAMS.forEach((p, n) => {
	if (p.code.length > 16) throw new Error(`program ${n} "${p.name}" is longer than 16 bytes`);
	p.code.forEach(([m, arg = 0], i) => {
		if (arg < 0 || arg > 15)
			throw new Error(`program ${n} "${p.name}": operand ${arg} out of range`);
		DATA[n * 16 + i] = (OP[m] << 4) | arg;
	});
	for (const [addr, value] of Object.entries(p.data ?? {})) {
		const a = Number(addr);
		if (a < p.code.length) throw new Error(`program ${n} "${p.name}": data at ${a} overlaps code`);
		DATA[n * 16 + a] = value;
	}
});

export const PROGRAM_EEPROM = createEeprom({
	id: 'PROGRAM_EEPROM',
	name: 'Program ROM',
	addressBits: 11,
	dataBits: 8,
	data: DATA,
});
