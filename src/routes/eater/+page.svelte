<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';
	import {
		AND2,
		OR2,
		NOT,
		NAND2,
		DFF,
		CLOCK,
		GND,
		VCC,
		BUS,
	} from '$lib/circuit/components/primitives';
	import { SEVEN_SEGMENT_HEX_DECODER } from '$lib/circuit/components/composites/eeproms';
	import { SEVEN_SEGMENT_DISPLAY } from '$lib/circuit/components/composites/displays';
	import { SR_LATCH, D_LATCH, DFF_GATES } from '$lib/circuit/components/composites/latches';
	import CLOCK_MODULE from '../../eater/clock.json';
	import CPU from '../../eater/cpu.json';
	import {
		componentDefinitionSchema,
		type CompositeDefinition,
		type DefinitionLibrary,
	} from '$lib/schemas/circuit';
	import { browser } from '$app/env';

	let library: DefinitionLibrary = emptyLibrary;
	for (const def of [
		// Primitives
		AND2,
		OR2,
		NOT,
		NAND2,
		GND,
		DFF,
		VCC,
		CLOCK,
		BUS,

		// Latches
		SR_LATCH,
		D_LATCH,
		DFF_GATES,

		// EEPROMs
		SEVEN_SEGMENT_HEX_DECODER,
		SEVEN_SEGMENT_DISPLAY,

		// Demos
		componentDefinitionSchema.parse(CLOCK_MODULE),
		componentDefinitionSchema.parse(CPU),
	]) {
		library = registerDefinition(library, def as CompositeDefinition);
	}
	let width = $derived(browser ? window.innerWidth - 50 : 200);
	let height = $derived(browser ? window.innerHeight - 100 : 200);
</script>

{#if Object.keys(library).length > 0}
	<CircuitCanvas {library} rootDefinitionId="EATER_CPU" {width} {height} />
{/if}
