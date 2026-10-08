<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';

	import { type CompositeDefinition, type DefinitionLibrary } from '$lib/schemas/circuit';
	import { browser } from '$app/env';
	import { PRIMITIVE_DEFS } from '#circuit/components/primitives/index';
	import { COMPOSITE_DEFS } from '#circuit/components/composites/index';
	import { EATER_EEPROMS } from '../../eater/eeproms';
	import { CHIPS } from '../../eater/chips';
	import { EATER_COMPUTER } from '../../eater';

	let library: DefinitionLibrary = $derived.by(() => {
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

		const CUSTOM_OUTPUT: CompositeDefinition = {
			...(library['OUTPUT_MODULE'] as CompositeDefinition),
			id: 'CUSTOM_OUTPUT',
			name: 'Output with display',
			minCanvasWidth: 2000,
			minCanvasHeight: 870,
			outputs: [],
			children: [
				...(library['OUTPUT_MODULE'] as CompositeDefinition).children,
				{
					instanceId: 'disp1',
					definitionId: 'SEVEN_SEGMENT_DISPLAY',
					column: 8,
					groupName: 'output',
				},
				{
					instanceId: 'disp2',
					definitionId: 'SEVEN_SEGMENT_DISPLAY',
					column: 7,
					groupName: 'output',
				},
				{
					instanceId: 'disp3',
					definitionId: 'SEVEN_SEGMENT_DISPLAY',
					column: 6,
					groupName: 'output',
				},
				{
					instanceId: 'disp4',
					definitionId: 'SEVEN_SEGMENT_DISPLAY',
					column: 5,
					groupName: 'output',
				},
			],
		};
		for (let wire of CUSTOM_OUTPUT.internalWires) {
			if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D0')) {
				wire.to = [
					{ component: 'disp1', pinId: 'a' },
					{ component: 'disp2', pinId: 'a' },
					{ component: 'disp3', pinId: 'a' },
					{ component: 'disp4', pinId: 'a' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D1')) {
				wire.to = [
					{ component: 'disp1', pinId: 'b' },
					{ component: 'disp2', pinId: 'b' },
					{ component: 'disp3', pinId: 'b' },
					{ component: 'disp4', pinId: 'b' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D2')) {
				wire.to = [
					{ component: 'disp1', pinId: 'c' },
					{ component: 'disp2', pinId: 'c' },
					{ component: 'disp3', pinId: 'c' },
					{ component: 'disp4', pinId: 'c' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D3')) {
				wire.to = [
					{ component: 'disp1', pinId: 'd' },
					{ component: 'disp2', pinId: 'd' },
					{ component: 'disp3', pinId: 'd' },
					{ component: 'disp4', pinId: 'd' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D4')) {
				wire.to = [
					{ component: 'disp1', pinId: 'e' },
					{ component: 'disp2', pinId: 'e' },
					{ component: 'disp3', pinId: 'e' },
					{ component: 'disp4', pinId: 'e' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D5')) {
				wire.to = [
					{ component: 'disp1', pinId: 'f' },
					{ component: 'disp2', pinId: 'f' },
					{ component: 'disp3', pinId: 'f' },
					{ component: 'disp4', pinId: 'f' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D6')) {
				wire.to = [
					{ component: 'disp1', pinId: 'g' },
					{ component: 'disp2', pinId: 'g' },
					{ component: 'disp3', pinId: 'g' },
					{ component: 'disp4', pinId: 'g' },
				];
			} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D7')) {
				wire.to = [
					{ component: 'disp1', pinId: 'dp' },
					{ component: 'disp2', pinId: 'dp' },
					{ component: 'disp3', pinId: 'dp' },
					{ component: 'disp4', pinId: 'dp' },
				];
			} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y0_n')) {
				wire.to = [{ component: 'disp1', pinId: 'en' }];
			} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y1_n')) {
				wire.to = [{ component: 'disp2', pinId: 'en' }];
			} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y2_n')) {
				wire.to = [{ component: 'disp3', pinId: 'en' }];
			} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y3_n')) {
				wire.to = [{ component: 'disp4', pinId: 'en' }];
			}
		}
		library = registerDefinition(library, CUSTOM_OUTPUT);
		return library;
	});
	let wrapperW = $state(0);
	let wrapperH = $state(0);

	let width = $derived(browser ? wrapperW - 32 : 200);
	let height = $derived(browser ? Math.max(30, wrapperH - 170) : 500);
</script>

{#if Object.keys(library).length > 0}
	<div class="narrow" bind:clientWidth={wrapperW} bind:clientHeight={wrapperH}>
		<h1>How does the output module work?</h1>
		<div class="border">
			<CircuitCanvas {library} rootDefinitionId="CUSTOM_OUTPUT" {width} {height} />
		</div>
	</div>
{/if}
