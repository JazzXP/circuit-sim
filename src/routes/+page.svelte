<script lang="ts">
	import CLOCK from '../eater/clock.json';
</script>

<div>
	<h1>Ben Eater style CPU</h1>
	<p>
		Based on Ben Eater's <a
			href="https://www.youtube.com/watch?v=HyznrdDSSGM&list=PLowKtXNTBypGqImE405J2565dvjafglHU"
			>YouTube</a
		> series.
	</p>
	<p>
		It's not an exact replica, for example, I have a EEPROM with programs preloaded on it that can
		be accessed by selecting the Program Select inputs (3-bit binary), and selecting Load Program
		and letting it run for 20 cycles.
	</p>
	<p>
		Some pages take a <strong>long</strong> time to load (for example, the CPU takes about 15 seconds
		on my M1 Macbook Pro), I'm calculating the routing on the fly, the components are just defined in
		JSON files, as a list of child components and wire connections. For example, the clock module looks
		like:-
	</p>
	<details>
		<summary>Long JSON file - click to show</summary>
		<pre><code>{JSON.stringify(CLOCK, undefined, 2)}</code></pre>
	</details>
	<p>
		The routing algorithm definitely isn't the best (It's based on A*), and there's a couple of
		minor visual issues (some wires loop back over themselves). But for the most part, it gets the
		job done.
	</p>
	<p>
		As for how to use it? You can either click on the inputs to the left of the circuit, or on the
		circuit itself. Any pins can also be clicked on to add a probe at that point for historical
		view.
	</p>
	<p>
		For any components with a clock, we automatically add a clock timer below the canvas (for
		example, the CPU has two) that you can adjust the timing on, so you can see what's going on.
	</p>
	<p>
		Seven segment displays have a slight fade to them, mainly because when we multiplex them, it
		reduces the flashing and makes them easier to read.
	</p>
</div>

<style>
	div {
		overflow: auto;
		max-width: 960px;
		margin-inline: auto;
	}
</style>
