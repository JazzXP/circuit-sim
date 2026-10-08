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
	import { page } from '$app/state';

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
	let height = $derived(browser ? Math.max(30, wrapperH - 170) : 500);

	const pageToComponent = {
		clock: 'EATER_CLOCK',
		alu: 'ALU',
		control: 'CONTROL_MODULE',
		pc: 'PC',
	};
	const titlesFromPage = {
		clock: 'a computer clock',
		alu: 'an ALU',
		control: 'a control module',
		pc: 'a program counter',
	};
	const getComponent = (comp?: string) => {
		if (!Object.keys(pageToComponent).find((c) => c === comp)) return '';
		return pageToComponent[comp as keyof typeof pageToComponent];
	};
	const getTitle = (page?: string) => {
		if (!Object.keys(titlesFromPage).find((c) => c === page)) return '';
		return titlesFromPage[page as keyof typeof titlesFromPage];
	};
</script>

{#if Object.keys(library).length > 0}
	<div class="narrow" bind:clientWidth={wrapperW} bind:clientHeight={wrapperH}>
		<h1>How does {getTitle(page.params.composite)} work?</h1>
		<div class="border">
			{#key page.params.composite}
				<CircuitCanvas
					{library}
					rootDefinitionId={getComponent(page.params.composite)}
					{width}
					{height}
				/>
			{/key}
		</div>
	</div>
{/if}
