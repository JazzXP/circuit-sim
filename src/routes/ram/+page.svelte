<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';

	import { browser } from '$app/env';
	import { getDefinitionLibraryContext } from '#circuit/render/cacheContext';

	const library = getDefinitionLibraryContext();
	let wrapperW = $state(0);
	let wrapperH = $state(0);

	let width = $derived(browser ? wrapperW - 32 : 200);
	let height = $derived(browser ? Math.max(30, wrapperH - 220) : 500);
</script>

{#if Object.keys(library).length > 0}
	<div class="h-full" bind:clientWidth={wrapperW} bind:clientHeight={wrapperH}>
		<h1>How does the RAM work?</h1>
		<div class="tabs tabs-lift h-full">
			<input type="radio" name="ram" class="tab" aria-label="Memory address register" checked />
			<div class="tab-content bg-base-100 border-base-300 p-6">
				<h2 class="mt-0">Memory address register</h2>
				<CircuitCanvas {library} rootDefinitionId="MAR" {width} {height} />
			</div>
			<input type="radio" name="ram" class="tab" aria-label="RAM" />
			<div class="tab-content bg-base-100 border-base-300 p-6">
				<h2 class="mt-0">RAM</h2>
				<CircuitCanvas {library} rootDefinitionId="RAM" {width} {height} />
			</div>
		</div>
	</div>
{/if}
