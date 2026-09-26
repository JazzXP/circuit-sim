<script lang="ts">
	import { emptyLibrary, registerDefinition } from '$lib/circuit/sim/model/component';
	import {
		AND2,
		OR2,
		NOT,
		NAND2,
		DFF,
		CLOCK,
		VCC,
		GND,
		TRI_BUFFER,
		createBus,
	} from '$lib/circuit/components/primitives';
	import { SR_LATCH, D_LATCH, DFF_GATES } from '$lib/circuit/components/composites/latches';
	import { componentDefinitionSchema, type DefinitionLibrary } from '$lib/schemas/circuit';
	import { SEVEN_SEGMENT_HEX_DECODER } from '#circuit/components/composites/eeproms/index';
	import { SEVEN_SEGMENT_DISPLAY } from '#circuit/components/composites/displays/index';
	import COUNTER_4BIT from '../examples/counter4bit.json';
	import CLOCKED_DFF_DEMO from '../examples/clockedDff.json';
	import DIGIT_DISPLAY_DEMO from '../examples/digitDisplay.json';
	import CLOCKED_COUNTER from '../examples/clockedCounter.json';
	import SHARED_BUS_DEMO from '../examples/sharedBus.json';
	import { CHIP_74LS173 } from '#circuit/components/composites/chips/74ls173';
	import CircuitCanvas from '$lib/components/CircuitCanvas.svelte';
	import { OUTPUT } from '../eater/output';

	let library: DefinitionLibrary = emptyLibrary;
	for (const def of [
		AND2,
		OR2,
		NOT,
		NAND2,
		DFF,
		CLOCK,
		VCC,
		GND,
		TRI_BUFFER,

		// Busses
		createBus({ id: 'BUS3', name: 'Bus (3 drivers)', driverCount: 3 }),

		// EEPROMS
		SEVEN_SEGMENT_HEX_DECODER,
		SEVEN_SEGMENT_DISPLAY,

		// LATCHES
		SR_LATCH,
		D_LATCH,
		DFF_GATES,

		componentDefinitionSchema.parse(CHIP_74LS173),

		componentDefinitionSchema.parse(COUNTER_4BIT),
		componentDefinitionSchema.parse(CLOCKED_DFF_DEMO),
		componentDefinitionSchema.parse(DIGIT_DISPLAY_DEMO),
		componentDefinitionSchema.parse(CLOCKED_COUNTER),
		componentDefinitionSchema.parse(SHARED_BUS_DEMO),
		OUTPUT,
	]) {
		library = registerDefinition(library, def);
	}
</script>

<h1>D flip-flop, built from gates</h1>
<p>
	Toggle D and CLK on the root view. Click the master or slave block to drill in — all the way down
	to the two cross-coupled NAND gates that actually hold the bit.
</p>

<CircuitCanvas {library} rootDefinitionId="DFF_GATES" width={1000} />

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

<CircuitCanvas {library} rootDefinitionId="DIGIT_DISPLAY_DEMO" width={600} height={260} />

<h1 style="margin-top: 48px">Fully automatic counter</h1>
<p>
	No switches here at all — press play on the clock and the count runs entirely on its own: CLOCK
	drives COUNTER_4BIT, which addresses the hex decoder, which drives the display. OE' is tied
	permanently low by a GND component, not a switch.
</p>

<CircuitCanvas {library} rootDefinitionId="CLOCKED_COUNTER" width={1500} height={280} />

<h1 style="margin-top: 48px">Shared bus</h1>
<p>
	Three tri-state buffers (A, B, C) all drive the same single-bit bus. Enable exactly one at a time
	and its value passes through. Enable none and the bus floats (shown in purple — distinct from a
	driven LOW). Enable <strong>two with different values</strong> and you'll get a persistent-contention
	warning (shown in red) rather than a silently wrong answer — try it. A brief, purely transient disagreement
	while something settles is normal and won't trigger this; only a genuinely persistent conflict does.
</p>

<CircuitCanvas {library} rootDefinitionId="SHARED_BUS_DEMO" width={650} height={300} />
