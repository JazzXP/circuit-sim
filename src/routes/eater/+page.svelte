<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';
	import {
		AND2,
		OR2,
		XOR2,
		NOT,
		NAND2,
		XNOR2,
		NOR2,
		DFF,
		CLOCK,
		GND,
		VCC,
		AND3,
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
	import CHIP_74LS157 from '../../eater/chips/74ls157.json';
	import MAR from '../../eater/mar.json';
	import RAM from '../../eater/ram.json';
	import {
		componentDefinitionSchema,
		type CompositeDefinition,
		type DefinitionLibrary,
	} from '$lib/schemas/circuit';
	import { browser } from '$app/env';
	import { CHIP_74LS173 } from '#circuit/components/composites/chips/74ls173';

	let library: DefinitionLibrary = emptyLibrary;
	for (const def of [
		// Primitives
		AND2,
		OR2,
		NOT,
		NAND2,
		XNOR2,
		XOR2,
		NOR2,
		GND,
		DFF,
		VCC,
		CLOCK,
		TRI_BUFFER,
		AND3,

		// Latches
		SR_LATCH,
		D_LATCH,
		DFF_GATES,

		// Buses
		createBus({ id: 'BUS', name: 'Bus ', driverCount: 8 }),

		// EEPROMs
		SEVEN_SEGMENT_HEX_DECODER,
		SEVEN_SEGMENT_DISPLAY,

		// Misc
		TRANSCEIVER_1BIT,
		TRANSCEIVER_8BIT,
		FULL_ADDER,
		componentDefinitionSchema.parse(CHIP_74LS157),
		componentDefinitionSchema.parse(CHIP_74LS173),
		componentDefinitionSchema.parse(CHIP_74LS274),

		// Demos
		componentDefinitionSchema.parse(CLOCK_MODULE),
		componentDefinitionSchema.parse(CPU),
		componentDefinitionSchema.parse(BUS_DRIVER),
		componentDefinitionSchema.parse(REGISTER),
		componentDefinitionSchema.parse(INSTRUCTION_REGISTER),
		componentDefinitionSchema.parse(ALU),
		componentDefinitionSchema.parse(MAR),
		componentDefinitionSchema.parse(RAM),
	]) {
		library = registerDefinition(library, def as CompositeDefinition);
	}
	let width = $derived(browser ? window.innerWidth - 50 : 200);
	let height = $derived(browser ? window.innerHeight - 100 : 200);
</script>

{#if Object.keys(library).length > 0}
	<CircuitCanvas {library} rootDefinitionId="EATER_CPU" {width} {height} />
{/if}
