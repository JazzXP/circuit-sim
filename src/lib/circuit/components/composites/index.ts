import { componentDefinitionSchema } from '$lib/schemas/circuit';
import { DFF } from '../primitives';
import DECODER_3_TO_8 from './decoder-3-to-8.json';
import DECODER_4_TO_6 from './decoder-4-to-6.json';
import { SEVEN_SEGMENT_DISPLAY } from './displays/sevenSegment';
import { SEVEN_SEGMENT_HEX_DECODER } from './eeproms/sevenSegmentDecoder';
import MUX16_1BIT from './mux-16-bit.json';
import MUX2_1BIT from './mux-2-1-bit.json';
import RAM_WORD_4BIT from './ram-word-4-bit.json';
import JK_ASYNC from './latches/jk-async.json';
import SR_LATCH from './latches/sr-latch.json';
import D_LATCH from './latches/d-latch.json';
import DFF_GATES from './latches/dff.json';
import TRANSCEIVER_1BIT from './transceiver_1-bit.json';
import TRANSCEIVER_8BIT from './transceiver_8-bit.json';
import FULL_ADDER from './full_adder.json';

export const COMPOSITE_DEFS = [
	SEVEN_SEGMENT_DISPLAY,
	SEVEN_SEGMENT_HEX_DECODER,
	DFF,
	...[
		DFF_GATES,
		D_LATCH,
		SR_LATCH,
		JK_ASYNC,
		DECODER_3_TO_8,
		DECODER_4_TO_6,
		MUX2_1BIT,
		MUX16_1BIT,
		RAM_WORD_4BIT,
		TRANSCEIVER_1BIT,
		TRANSCEIVER_8BIT,
		FULL_ADDER,
	].map((c) => componentDefinitionSchema.parse(c)),
];
