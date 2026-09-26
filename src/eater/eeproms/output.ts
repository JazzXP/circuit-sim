import { createEeprom } from '#components/primitives/eeprom';

// 28C16: 2K x 8 EEPROM (2048 words, 8 bits each -> addressBits = 11, dataBits = 8).
// Unlike SEVEN_SEGMENT_HEX_DECODER, the 28C16 has no fixed "correct" content —
// it's a general-purpose byte-wide EEPROM, commonly used as microcode / control
// ROM in breadboard-CPU builds (Ben Eater style) or as general lookup storage.
//
// Placeholder content: all zero bytes. Replace DATA below with whatever you've
// programmed into the chip (e.g. a microcode table, a font, a lookup function).
const DATA: readonly number[] = new Array(2 ** 11).fill(0x00);

export const OUTPUT_EEPROM = createEeprom({
	id: 'OUTPUT_EEPROM',
	name: 'OUTPUT_EEPROM',
	addressBits: 11,
	dataBits: 8,
	data: DATA,
});
