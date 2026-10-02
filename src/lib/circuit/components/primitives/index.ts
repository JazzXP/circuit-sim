import { AND2, AND3, AND4 } from './and';
import { CLOCK } from './clock';
import { DFF } from './dff';
import { GND } from './gnd';
import { NAND2, NAND3, NAND4 } from './nand';
import { NOR2 } from './nor';
import { NOT } from './not';
import { OR2 } from './or';
import { TRI_BUFFER } from './triBuffer';
import { VCC } from './vcc';
import { XNOR2 } from './xnor';
import { XOR2 } from './xor';

export * from './and';
export * from './dff';
export * from './nand';
export * from './not';
export * from './or';
export * from './xor';
export * from './xnor';
export * from './nor';
export * from './clock';
export * from './vcc';
export * from './gnd';
export * from './triBuffer';

export * from './eeprom';
export * from './timer';

export const PRIMITIVE_DEFS = [
	AND2,
	AND3,
	AND4,
	DFF,
	NAND2,
	NAND3,
	NAND4,
	NOT,
	OR2,
	XOR2,
	XNOR2,
	NOR2,
	CLOCK,
	VCC,
	GND,
	TRI_BUFFER,
];
