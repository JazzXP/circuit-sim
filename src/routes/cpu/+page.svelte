<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';

	import { browser } from '$app/env';
	import { getDefinitionLibraryContext } from '#circuit/render/cacheContext';

	const library = getDefinitionLibraryContext();
	let wrapperW = $state(0);
	let wrapperH = $state(0);

	let width = $derived(browser ? window.innerWidth - 64 : 200);
	let height = $derived(browser ? Math.max(30, wrapperH - 240) : 500);
</script>

{#if Object.keys(library).length > 0}
	<div class="narrow" bind:clientWidth={wrapperW} bind:clientHeight={wrapperH}>
		<h1>How does the CPU work?</h1>
		<div class="border">
			<CircuitCanvas {library} rootDefinitionId="EATER_CPU" {width} {height} />
		</div>
	</div>
{/if}
