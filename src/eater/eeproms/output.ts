import { createEeprom } from '#components/primitives/eeprom';

// 28C16: 2K x 8 EEPROM (addressBits = 11, dataBits = 8) used as the display decoder.
// Segment bits: a=bit0 b=bit1 c=bit2 d=bit3 e=bit4 f=bit5 g=bit6 dp=bit7.
// Address: A0-A7 = value, A8-A9 = digit (0 ones, 1 tens, 2 hundreds, 3 sign),
// A10 = signed mode.
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
	DATA[(i & 0xff) + 1792] = i < 0 ? 0x40 : 0; // minus = segment g (bit 6)
}

export const OUTPUT_EEPROM = createEeprom({
	id: 'OUTPUT_EEPROM',
	name: 'OUTPUT_EEPROM',
	addressBits: 11,
	dataBits: 8,
	data: DATA,
});
