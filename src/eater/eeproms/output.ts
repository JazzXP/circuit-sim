import { createEeprom } from '#components/primitives/eeprom';

// 28C16: 2K x 8 EEPROM (2048 words, 8 bits each -> addressBits = 11, dataBits = 8).
// Unlike SEVEN_SEGMENT_HEX_DECODER, the 28C16 has no fixed "correct" content —
// it's a general-purpose byte-wide EEPROM, commonly used as microcode / control
// ROM in breadboard-CPU builds (Ben Eater style) or as general lookup storage.
//
// Placeholder content: all zero bytes. Replace DATA below with whatever you've
// programmed into the chip (e.g. a microcode table, a font, a lookup function).
const digits: readonly number[] =
	//[0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b];
	[
		0x3f, // 0
		0x06, // 1
		0x5b, // 2
		0x4f, // 3
		0x66, // 4
		0x6d, // 5
		0x7d, // 6
		0x07, // 7
		0x7f, // 8
		0x6f, // 9
	];
const DATA: number[] = new Array(2 ** 11);
for (let i = 0; i <= 255; i++) {
	DATA[i] = digits[i % 10];
	DATA[i + 256] = digits[Math.trunc(i / 10) % 10];
	DATA[i + 512] = digits[Math.trunc(i / 100) % 10];
	DATA[i + 768] = 0x00;
}
for (let i = -128; i <= 127; i++) {
	DATA[(i & 0xff) + 1024] = digits[Math.abs(i) % 10];
	DATA[(i & 0xff) + 1280] = digits[Math.trunc(Math.abs(i) / 10) % 10];
	DATA[(i & 0xff) + 1536] = digits[Math.trunc(Math.abs(i) / 100) % 10];
	DATA[(i & 0xff) + 1792] = i < 0 ? 0x01 : 0;
}

export const OUTPUT_EEPROM = createEeprom({
	id: 'OUTPUT_EEPROM',
	name: 'OUTPUT_EEPROM',
	addressBits: 11,
	dataBits: 8,
	data: DATA,
});
