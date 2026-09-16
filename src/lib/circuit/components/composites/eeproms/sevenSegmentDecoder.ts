import { createEeprom } from '#components/primitives/eeprom';

// A concrete, ready-to-use EEPROM: decodes a 4-bit hex digit (A0-A3) into
// the 7 segment-driver outputs (D0-D6 = segments a-g) of a common-cathode
// 7-segment display. Standard table — this is the exact byte sequence you'll
// see in most embedded 7-seg tutorials (0x3F, 0x06, 0x5B, ...).
//
// Bit order per entry: bit0=a, bit1=b, bit2=c, bit3=d, bit4=e, bit5=f, bit6=g.
const SEGMENT_TABLE: readonly number[] = [
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
	0x77, // A
	0x7c, // b
	0x39, // C
	0x5e, // d
	0x79, // E
	0x71 // F
];

export const SEVEN_SEGMENT_HEX_DECODER = createEeprom({
	id: 'SEVEN_SEGMENT_HEX_DECODER',
	name: '7-Seg Decoder',
	addressBits: 4,
	dataBits: 7,
	data: SEGMENT_TABLE
});
