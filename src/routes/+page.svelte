<script lang="ts">
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';
	import { AND2, OR2, NOT, NAND2, DFF, CLOCK, GND, VCC } from '$lib/circuit/components/primitives';
	import { SEVEN_SEGMENT_HEX_DECODER } from '$lib/circuit/components/composites/eeproms';
	import { SEVEN_SEGMENT_DISPLAY } from '$lib/circuit/components/composites/displays';
	import { SR_LATCH, D_LATCH, DFF_GATES } from '$lib/circuit/components/composites/latches';
	import DIGIT_DISPLAY_DEMO from '../examples/digitDisplay.json';
	import CLOCKED_DFF_DEMO from '../examples/clockedDff.json';
	import CLOCKED_COUNTER from '../examples/clockedCounter.json';
	import COUNTER_4BIT from '../examples/counter4bit.json';
	import {
		componentDefinitionSchema,
		type CompositeDefinition,
		type DefinitionLibrary,
	} from '$lib/schemas/circuit';

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

		// Latches
		SR_LATCH,
		D_LATCH,
		DFF_GATES,

		// EEPROMs
		SEVEN_SEGMENT_HEX_DECODER,
		SEVEN_SEGMENT_DISPLAY,

		// Demos
		componentDefinitionSchema.parse(CLOCKED_DFF_DEMO),
		componentDefinitionSchema.parse(DIGIT_DISPLAY_DEMO),
		componentDefinitionSchema.parse(CLOCKED_COUNTER),
		componentDefinitionSchema.parse(COUNTER_4BIT),
	]) {
		library = registerDefinition(library, def as CompositeDefinition);
	}
</script>

<h1>D flip-flop, built from gates</h1>
<p>
	Toggle D and CLK on the root view. Click the master or slave block to drill in — all the way down
	to the two cross-coupled NAND gates that actually hold the bit.
</p>

<CircuitCanvas {library} rootDefinitionId="DFF_GATES" />

<h1 style="margin-top: 48px">Clock-driven register</h1>
<p>
	Set D, then press play on the clock and drag its speed slider. Q latches on every rising edge,
	automatically, with no manual CLK toggling needed. Drilling into "dff" still works exactly as
	before while the clock keeps running in the background.
</p>

<CircuitCanvas {library} rootDefinitionId="CLOCKED_DFF_DEMO" width={500} />

<h1 style="margin-top: 48px">Hex digit display</h1>
<p>
	Toggle A0-A3 to pick a hex digit (0-F) and OE' to enable the ROM's output. The decoder's D0-D6
	outputs feed straight into the display's a-g segment inputs — the display itself computes nothing,
	it's a pure indicator of whatever it's fed.
</p>

<CircuitCanvas {library} rootDefinitionId="DIGIT_DISPLAY_DEMO" width={1000} height={260} />

<CircuitCanvas {library} rootDefinitionId="COUNTER_4BIT" width={1500} height={500} />
