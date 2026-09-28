<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';
	import {
		AND2,
		AND3,
		AND4,
		OR2,
		XOR2,
		NOT,
		NAND2,
		NAND3,
		NAND4,
		XNOR2,
		NOR2,
		DFF,
		CLOCK,
		GND,
		VCC,
		createBus,
		TRI_BUFFER,
	} from '$lib/circuit/components/primitives';
	import { SEVEN_SEGMENT_HEX_DECODER } from '$lib/circuit/components/composites/eeproms';
	import { SEVEN_SEGMENT_DISPLAY } from '$lib/circuit/components/composites/displays';
	import { SR_LATCH, D_LATCH, DFF_GATES } from '$lib/circuit/components/composites/latches';
	import CLOCK_MODULE from '../../eater/clock.json';
	import CPU from '../../eater/cpu.json';
	import BUS_DRIVER from '../../eater/bus_driver.json';
	import TRANSCEIVER_1BIT from '../../eater/transceiver_1-bit.json';
	import TRANSCEIVER_8BIT from '../../eater/transceiver_8-bit.json';
	import REGISTER from '../../eater/register.json';
	import INSTRUCTION_REGISTER from '../../eater/instruction_register.json';
	import ALU from '../../eater/alu.json';
	import FULL_ADDER from '../../eater/full_adder.json';
	import CHIP_74LS274 from '../../eater/chips/74ls283.json';
	import CHIP_74LS139 from '../../eater/chips/74ls139.json';
	import CHIP_74LS157 from '../../eater/chips/74ls157.json';
	import CHIP_74LS161 from '../../eater/chips/74ls161.json';
	import CHIP_74LS76 from '../../eater/chips/74ls76.json';
	import CHIP_74LS273 from '../../eater/chips/74ls273.json';
	import JK_ASYNC from '$lib/circuit/components/composites/latches/jk-async.json';
	import { CHIP_74LS173 } from '#circuit/components/composites/chips/74ls173';
	import DECODER_4_to_6 from '$lib/circuit/components/composites/decoder-4-to-6.json';
	import MUX16_1BIT from '$lib/circuit/components/composites/mux-16-bit.json';
	import MUX2_1BIT from '$lib/circuit/components/composites/mux-2-1-bit.json';
	import RAM_WORD_4BIT from '$lib/circuit/components/composites/ram-word-4-bit.json';
	import CHIP_74189 from '../../eater/chips/74189.json';
	import DECODER_3_TO_8 from '$lib/circuit/components/composites/decoder-3-to-8.json';
	import MAR from '../../eater/mar.json';
	import RAM from '../../eater/ram.json';
	import PC from '../../eater/program_counter.json';
	import OUTPUT from '../../eater/output.json';
	import CONTROL from '../../eater/control.json';
	import {
		componentDefinitionSchema,
		type CompositeDefinition,
		type DefinitionLibrary,
	} from '$lib/schemas/circuit';
	import { browser } from '$app/env';
	import { createTimer } from '#circuit/components/primitives/timer';
	import { OUTPUT_EEPROM } from '../../eater/eeproms/output';
	import { CONTROL_EEPROM_1, CONTROL_EEPROM_2 } from '../../eater/eeproms/control';

	let library: DefinitionLibrary = emptyLibrary;
	for (const def of [
		// Primitives
		AND2,
		AND3,
		AND4,
		OR2,
		NOT,
		NAND2,
		NAND3,
		NAND4,
		XNOR2,
		XOR2,
		NOR2,
		GND,
		DFF,
		VCC,
		CLOCK,
		TRI_BUFFER,

		// Latches
		SR_LATCH,
		D_LATCH,
		DFF_GATES,
		JK_ASYNC,

		// Buses
		createBus({ id: 'BUS', name: 'Bus ', driverCount: 8 }),

		// Timers
		createTimer({ id: 'OUTPUT_TIMER', name: 'output_timer', time: 1.5 }),

		// EEPROMs
		SEVEN_SEGMENT_HEX_DECODER,
		SEVEN_SEGMENT_DISPLAY,
		OUTPUT_EEPROM,
		CONTROL_EEPROM_1,
		CONTROL_EEPROM_2,

		// Misc
		TRANSCEIVER_1BIT,
		TRANSCEIVER_8BIT,
		FULL_ADDER,
		componentDefinitionSchema.parse(CHIP_74LS76),
		componentDefinitionSchema.parse(CHIP_74LS139),
		componentDefinitionSchema.parse(CHIP_74LS157),
		componentDefinitionSchema.parse(CHIP_74LS173),
		componentDefinitionSchema.parse(CHIP_74LS273),
		componentDefinitionSchema.parse(CHIP_74LS274),
		componentDefinitionSchema.parse(CHIP_74LS161),
		componentDefinitionSchema.parse(CHIP_74189),
		componentDefinitionSchema.parse(DECODER_4_to_6),
		componentDefinitionSchema.parse(DECODER_3_TO_8),
		componentDefinitionSchema.parse(MUX16_1BIT),
		componentDefinitionSchema.parse(MUX2_1BIT),
		componentDefinitionSchema.parse(RAM_WORD_4BIT),

		// Demos
		componentDefinitionSchema.parse(CLOCK_MODULE),
		componentDefinitionSchema.parse(CPU),
		componentDefinitionSchema.parse(BUS_DRIVER),
		componentDefinitionSchema.parse(REGISTER),
		componentDefinitionSchema.parse(INSTRUCTION_REGISTER),
		componentDefinitionSchema.parse(ALU),
		componentDefinitionSchema.parse(MAR),
		componentDefinitionSchema.parse(RAM),
		componentDefinitionSchema.parse(PC),
		componentDefinitionSchema.parse(OUTPUT),
		componentDefinitionSchema.parse(CONTROL),
	]) {
		library = registerDefinition(library, def as CompositeDefinition);
	}
	let width = $derived(browser ? window.innerWidth * 2 - 50 : 200);
	let height = $derived(browser ? window.innerHeight * 2 - 100 : 200);
	// let width = 1800;
	// let height = 3000;
</script>

{#if Object.keys(library).length > 0}
	<CircuitCanvas {library} rootDefinitionId="EATER_CPU" {width} {height} />
{/if}
