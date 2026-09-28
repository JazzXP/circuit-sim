import { createEeprom } from '#components/primitives/eeprom';

const DATA: readonly number[] = new Array(2 ** 11).fill(0x00);

export const CONTROL_EEPROM_1 = createEeprom({
	id: 'CONTROL_EEPROM_1',
	name: 'CONTROL_EEPROM_1',
	addressBits: 11,
	dataBits: 8,
	data: DATA,
});

export const CONTROL_EEPROM_2 = createEeprom({
	id: 'CONTROL_EEPROM_2',
	name: 'CONTROL_EEPROM_2',
	addressBits: 11,
	dataBits: 8,
	data: DATA,
});
