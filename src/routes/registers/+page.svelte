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
	import TabBar from '#svComponents/TabBar.svelte';

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
	let wrapperW = $state(0);
	let wrapperH = $state(0);

	let width = $derived(browser ? wrapperW - 32 : 200);
	let height = $derived(browser ? Math.max(30, wrapperH - 300) : 500);

	const tabs = ['Register A & B', 'Instruction Register'];
	let selectedTab = $state(tabs[0]);
</script>

{#if Object.keys(library).length > 0}
	<div class="narrow" bind:clientWidth={wrapperW} bind:clientHeight={wrapperH}>
		<h1>How do the registers work?</h1>
		<TabBar {tabs} bind:selectedTab />
		<div class="border tab" class:selected={selectedTab === tabs[0]}>
			<h2 id="reg">Register A &amp; B</h2>
			<CircuitCanvas {library} rootDefinitionId="REGISTER" {width} {height} />
		</div>
		<div class="border tab" class:selected={selectedTab === tabs[1]}>
			<h2 id="ir">Instruction Register</h2>
			<CircuitCanvas {library} rootDefinitionId="INSTRUCTION_REGISTER" {width} {height} />
		</div>
	</div>
{/if}
