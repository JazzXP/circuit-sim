<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';

	import { type DefinitionLibrary } from '$lib/schemas/circuit';
	import { browser } from '$app/env';
	import { PRIMITIVE_DEFS } from '#circuit/components/primitives/index';
	import { COMPOSITE_DEFS } from '#circuit/components/composites/index';
	import { EATER_EEPROMS } from '../../eater/eeproms';
	import { CHIPS } from '../../eater/chips';
	import { EATER_COMPUTER } from '../../eater';

	// svelte-ignore non_reactive_update
	let library: DefinitionLibrary = emptyLibrary;
	for (const def of [
		...PRIMITIVE_DEFS,
		...COMPOSITE_DEFS,
		...EATER_EEPROMS,
		...CHIPS,
		...EATER_COMPUTER,
	]) {
		library = registerDefinition(library, def);
	}
	let width = $derived(browser ? window.innerWidth - 20 : 200);
	let height = $derived(browser ? window.innerHeight - 160 : 200);
</script>

{#if Object.keys(library).length > 0}
	<CircuitCanvas {library} rootDefinitionId="EATER_CPU" {width} {height} />
{/if}
