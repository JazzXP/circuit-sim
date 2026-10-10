<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';

	import { type DefinitionLibrary } from '$lib/schemas/circuit';
	import { browser } from '$app/env';
	import { getDefinitionLibraryContext } from '#circuit/render/cacheContext';

	const library: DefinitionLibrary = getDefinitionLibraryContext();
	let wrapperW = $state(0);
	let wrapperH = $state(0);

	let width = $derived(browser ? wrapperW - 32 : 200);
	let height = $derived(browser ? Math.max(30, wrapperH - 220) : 100);
</script>

{#if Object.keys(library).length > 0}
	<div class="h-full" bind:clientWidth={wrapperW} bind:clientHeight={wrapperH}>
		<h1>How do the registers work?</h1>
		<div class="tabs tabs-lift h-full">
			<input type="radio" name="reg" class="tab" aria-label="Registers A & B" checked />
			<div class="tab-content bg-base-100 border-base-300 p-6">
				<h2 id="reg" class="mt-0">Register A &amp; B</h2>
				<CircuitCanvas {library} rootDefinitionId="REGISTER" {width} {height} />
			</div>
			<input type="radio" name="reg" class="tab" aria-label="Instruction Register" />
			<div class="tab-content bg-base-100 border-base-300 p-6">
				<h2 id="ir" class="mt-0">Instruction Register</h2>
				<CircuitCanvas {library} rootDefinitionId="INSTRUCTION_REGISTER" {width} {height} />
			</div>
		</div>
	</div>
{/if}
