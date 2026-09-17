<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { LogicValue } from '#sim/model/component';
	import { findInstancesByDefinition, updateInstanceStateAtPath } from '#sim/model/tree';
	import {
		evaluateTick,
		evaluateAtPath,
		instantiateAndSettle,
		type PinChange,
	} from '#sim/controller/engine';
	import type { ClockState } from '#components/primitives/clock';
	import { computeLayout } from '#render/layout';
	import { renderComposite, type ClickRegion } from '#render/canvasRenderer';
	import {
		DEFAULT_VIEW_TRANSFORM,
		screenToWorld,
		zoomAt,
		pan,
		type ViewTransform,
	} from '#render/viewTransform';
	import type { ComponentInstance, DefinitionLibrary } from '$lib/schemas/circuit';
	import { browser } from '$app/env';

	interface Props {
		library: DefinitionLibrary;
		rootDefinitionId: string;
		width?: number;
		height?: number;
	}

	let { library, rootDefinitionId, width = 720, height = 320 }: Props = $props();

	let canvasEl: HTMLCanvasElement;
	let rootInstance = $derived<ComponentInstance>(
		instantiateAndSettle(library, rootDefinitionId, 'root'),
	);
	let drillPath = $state<string[]>([]);
	let clickRegions: ClickRegion[] = [];
	let view = $state<ViewTransform>(DEFAULT_VIEW_TRANSFORM);

	// Every CLOCK instance anywhere in the tree, regardless of nesting depth —
	// recomputed whenever the tree changes so newly-drilled-into clocks (or
	// ones a future design might add dynamically) are picked up automatically.
	let clocks = $derived(findInstancesByDefinition(rootInstance, 'CLOCK'));

	function instanceAtPath(path: string[]): ComponentInstance {
		let current = rootInstance;
		for (const id of path) current = current.children![id];
		return current;
	}

	function toggleRootInput(pinId: string) {
		const current = rootInstance.pinValues[pinId];
		const next = current === LogicValue.HIGH ? LogicValue.LOW : LogicValue.HIGH;
		const change: PinChange = { ref: { component: 'self', pinId }, value: next };
		rootInstance = evaluateTick(library, rootInstance, [change]);
	}

	// Drilling into a different level resets the view — the old pan/zoom was
	// specific to that level's layout and generally won't make sense applied
	// to a different composite's content.
	function resetView() {
		view = DEFAULT_VIEW_TRANSFORM;
	}

	function drillInto(childId: string) {
		drillPath = [...drillPath, childId];
		resetView();
	}

	function drillToRoot() {
		drillPath = [];
		resetView();
	}

	function drillToIndex(i: number) {
		drillPath = drillPath.slice(0, i + 1);
		resetView();
	}

	// --- Clock driving -------------------------------------------------
	//
	// A clock's output depends on wall-clock time, not just its inputs, so
	// nothing will re-evaluate it unless something keeps nudging it. This
	// timer re-sends each clock's OWN current EN value every POLL_MS — not a
	// toggle, just a "check in" — via evaluateAtPath, which can reach a clock
	// at any depth in the tree, not only ones wired to the root. The clock's
	// own evaluate() (components/primitives/clock.ts) decides whether enough
	// time has actually passed to flip its output.
	const POLL_MS = 25;
	let pollHandle: ReturnType<typeof setInterval> | undefined;

	function pollClocks() {
		if (clocks.length === 0) return;
		let next = rootInstance;
		for (const { path, instance } of clocks) {
			const en = instance.pinValues['EN'];
			next = evaluateAtPath(library, next, path, [
				{ ref: { component: 'self', pinId: 'EN' }, value: en },
			]);
		}
		rootInstance = next;
	}

	function toggleClockRunning(path: readonly string[], currentlyRunning: boolean) {
		rootInstance = evaluateAtPath(library, rootInstance, path, [
			{
				ref: { component: 'self', pinId: 'EN' },
				value: currentlyRunning ? LogicValue.LOW : LogicValue.HIGH,
			},
		]);
	}

	function setClockPeriod(path: readonly string[], periodMs: number) {
		rootInstance = updateInstanceStateAtPath(rootInstance, path, (instance) => ({
			...instance,
			primitiveState: { ...(instance.primitiveState as ClockState), periodMs },
		}));
	}

	onMount(() => {
		pollHandle = setInterval(pollClocks, POLL_MS);
		// passive:false is required here — touchstart/touchmove default to
		// passive in most browsers, which would silently no-op preventDefault
		// and let the page scroll/zoom underneath the gesture.
		canvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
		canvasEl.addEventListener('touchmove', handleTouchMove, { passive: false });
		canvasEl.addEventListener('touchend', handleTouchEnd, { passive: false });
		canvasEl.addEventListener('touchcancel', handleTouchCancel, { passive: false });
	});
	onDestroy(() => {
		if (pollHandle) clearInterval(pollHandle);
		if (browser) {
			window.removeEventListener('mousemove', handleWindowMouseMove);
			window.removeEventListener('mouseup', handleWindowMouseUp);
		}
		canvasEl?.removeEventListener('touchstart', handleTouchStart);
		canvasEl?.removeEventListener('touchmove', handleTouchMove);
		canvasEl?.removeEventListener('touchend', handleTouchEnd);
		canvasEl?.removeEventListener('touchcancel', handleTouchCancel);
	});

	// --- Pan & zoom ------------------------------------------------------
	//
	// The canvas element itself stays a fixed size; `view` (scale + offset)
	// just changes how much of the fixed "world" coordinate space (the same
	// one computeLayout's boxes/pins are defined in) is visible and how
	// magnified it is. All the actual math lives in view-transform.ts and is
	// unit-tested there — this is just wiring DOM events to it.

	const DRAG_THRESHOLD = 4; // px of movement before a press counts as a pan, not a click

	let pointerDown = false;
	let dragging = $state(false);
	let dragStartScreen = { x: 0, y: 0 };
	let dragStartView = DEFAULT_VIEW_TRANSFORM;

	let pinching = false;
	let pinchStartDistance = 0;
	let pinchStartMidpoint = { x: 0, y: 0 };
	let pinchStartView = DEFAULT_VIEW_TRANSFORM;

	function canvasRelativePoint(clientX: number, clientY: number): { x: number; y: number } {
		const rect = canvasEl.getBoundingClientRect();
		return { x: clientX - rect.left, y: clientY - rect.top };
	}

	function performClickAt(screenX: number, screenY: number) {
		const world = screenToWorld(view, screenX, screenY);
		for (const region of clickRegions) {
			if (
				world.x >= region.x &&
				world.x <= region.x + region.w &&
				world.y >= region.y &&
				world.y <= region.y + region.h
			) {
				region.onClick();
				return;
			}
		}
	}

	// Wheel: a real mouse wheel and a trackpad's two-finger scroll both fire
	// plain "wheel" events, while a trackpad PINCH gesture is reported by
	// every major browser as a wheel event with ctrlKey set — a deliberate,
	// long-standing convention, not a requirement that Ctrl actually be held.
	// So: ctrlKey -> zoom (pinch), otherwise -> pan (scroll). This matches
	// the convention most modern diagram/canvas tools use.
	function normalizedDelta(e: WheelEvent): { dx: number; dy: number } {
		// DOM_DELTA_LINE (1) means deltas are in "lines" rather than pixels —
		// mostly seen from some mouse wheels — so scale up to roughly match
		// pixel-based trackpad deltas.
		const scale = e.deltaMode === 1 ? 16 : 1;
		return { dx: e.deltaX * scale, dy: e.deltaY * scale };
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const { x, y } = canvasRelativePoint(e.clientX, e.clientY);
		const { dx, dy } = normalizedDelta(e);
		if (e.ctrlKey) {
			const factor = Math.pow(2, -dy * 0.01);
			view = zoomAt(view, x, y, factor);
		} else {
			view = pan(view, -dx, -dy);
		}
	}

	// --- Mouse drag-to-pan / click ---

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return; // left button only
		pointerDown = true;
		dragging = false;
		dragStartScreen = canvasRelativePoint(e.clientX, e.clientY);
		dragStartView = view;
		window.addEventListener('mousemove', handleWindowMouseMove);
		window.addEventListener('mouseup', handleWindowMouseUp);
	}

	function handleWindowMouseMove(e: MouseEvent) {
		if (!pointerDown) return;
		const current = canvasRelativePoint(e.clientX, e.clientY);
		const dx = current.x - dragStartScreen.x;
		const dy = current.y - dragStartScreen.y;

		if (!dragging && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
			dragging = true;
		}
		if (dragging) {
			view = pan(dragStartView, dx, dy);
		}
	}

	function handleWindowMouseUp(e: MouseEvent) {
		window.removeEventListener('mousemove', handleWindowMouseMove);
		window.removeEventListener('mouseup', handleWindowMouseUp);
		if (!dragging) {
			const p = canvasRelativePoint(e.clientX, e.clientY);
			performClickAt(p.x, p.y);
		}
		pointerDown = false;
		dragging = false;
	}

	// --- Touch: one finger pans/taps, two fingers pinch-zoom-and-pan ---
	//
	// Registered manually via addEventListener with {passive:false} rather
	// than as Svelte template attributes — touchstart/touchmove listeners
	// default to passive in most browsers, which would silently make
	// preventDefault() a no-op and let the page scroll/zoom underneath us.

	function touchDistance(a: Touch, b: Touch): number {
		const pa = canvasRelativePoint(a.clientX, a.clientY);
		const pb = canvasRelativePoint(b.clientX, b.clientY);
		return Math.hypot(pa.x - pb.x, pa.y - pb.y);
	}

	function touchMidpoint(a: Touch, b: Touch): { x: number; y: number } {
		const pa = canvasRelativePoint(a.clientX, a.clientY);
		const pb = canvasRelativePoint(b.clientX, b.clientY);
		return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
	}

	function startSingleTouchPan(t: Touch) {
		pinching = false;
		pointerDown = true;
		dragging = false;
		dragStartScreen = canvasRelativePoint(t.clientX, t.clientY);
		dragStartView = view;
	}

	function handleTouchStart(e: TouchEvent) {
		e.preventDefault();
		if (e.touches.length === 1) {
			startSingleTouchPan(e.touches[0]);
		} else if (e.touches.length === 2) {
			pointerDown = false;
			pinching = true;
			pinchStartDistance = touchDistance(e.touches[0], e.touches[1]);
			pinchStartMidpoint = touchMidpoint(e.touches[0], e.touches[1]);
			pinchStartView = view;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		e.preventDefault();
		if (pinching && e.touches.length === 2) {
			const newDistance = touchDistance(e.touches[0], e.touches[1]);
			const newMidpoint = touchMidpoint(e.touches[0], e.touches[1]);
			const factor = pinchStartDistance === 0 ? 1 : newDistance / pinchStartDistance;
			const zoomed = zoomAt(pinchStartView, pinchStartMidpoint.x, pinchStartMidpoint.y, factor);
			view = pan(
				zoomed,
				newMidpoint.x - pinchStartMidpoint.x,
				newMidpoint.y - pinchStartMidpoint.y,
			);
		} else if (pointerDown && e.touches.length === 1) {
			const current = canvasRelativePoint(e.touches[0].clientX, e.touches[0].clientY);
			const dx = current.x - dragStartScreen.x;
			const dy = current.y - dragStartScreen.y;
			if (!dragging && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) dragging = true;
			if (dragging) view = pan(dragStartView, dx, dy);
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		e.preventDefault();
		if (pinching) {
			if (e.touches.length === 1) {
				// One finger lifted — keep going as a single-finger pan rather
				// than ending the interaction outright.
				startSingleTouchPan(e.touches[0]);
			} else if (e.touches.length === 0) {
				pinching = false;
			}
			return;
		}
		if (pointerDown) {
			if (!dragging) {
				const touch = e.changedTouches[0];
				if (touch) {
					const p = canvasRelativePoint(touch.clientX, touch.clientY);
					performClickAt(p.x, p.y);
				}
			}
			pointerDown = false;
			dragging = false;
		}
	}

	function handleTouchCancel() {
		pinching = false;
		pointerDown = false;
		dragging = false;
	}

	function zoomButton(factor: number) {
		view = zoomAt(view, width / 2, height / 2, factor);
	}

	// --- Rendering -------------------------------------------------------

	function draw() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		ctx.save();
		ctx.clearRect(0, 0, width, height);
		ctx.translate(view.offsetX, view.offsetY);
		ctx.scale(view.scale, view.scale);

		const instance = instanceAtPath(drillPath);
		const layout = computeLayout(library, instance.definitionId, width, height);
		const isRoot = drillPath.length === 0;

		clickRegions = renderComposite(ctx, library, instance, layout, {
			interactive: isRoot,
			onToggleInput: toggleRootInput,
			onDrillInto: drillInto,
		});
		ctx.restore();
	}

	// Redraw whenever the instance tree, drilled-into path, or view
	// transform changes. Note: while any clock is running, rootInstance gets
	// a fresh reference every POLL_MS regardless of whether a clock actually
	// toggled (the engine always returns a new object on a non-empty change,
	// even a no-op resend) — so this effectively becomes a ~40fps redraw
	// loop for as long as a clock is enabled, same cost as any other
	// animation.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		rootInstance;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		drillPath;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		view;
		draw();
	});

	onMount(draw);
</script>

<div class="circuit-canvas">
	<div class="toolbar">
		<div class="breadcrumb">
			<button onclick={drillToRoot} disabled={drillPath.length === 0}>
				{library[rootDefinitionId].name}
			</button>
			{#each drillPath as instanceId, i (i)}
				<span class="sep">&rsaquo;</span>
				<button onclick={() => drillToIndex(i)} disabled={i === drillPath.length - 1}>
					{instanceId}
				</button>
			{/each}
		</div>
		<div class="zoom-controls">
			<button onclick={() => zoomButton(1 / 1.3)} title="Zoom out">&minus;</button>
			<span class="zoom-level">{Math.round(view.scale * 100)}%</span>
			<button onclick={() => zoomButton(1.3)} title="Zoom in">&plus;</button>
			<button
				onclick={resetView}
				title="Reset view"
				disabled={view.scale === 1 && view.offsetX === 0 && view.offsetY === 0}
			>
				Reset
			</button>
		</div>
	</div>

	<canvas
		bind:this={canvasEl}
		{width}
		{height}
		onwheel={handleWheel}
		onmousedown={handleMouseDown}
		class:grabbing={dragging}
	></canvas>

	{#if clocks.length > 0}
		<div class="clocks">
			{#each clocks as clock (clock.path.join('.'))}
				{@const running = clock.instance.pinValues['EN'] === LogicValue.HIGH}
				{@const periodMs = (clock.instance.primitiveState as ClockState).periodMs}
				<div class="clock-row">
					<button class="play-pause" onclick={() => toggleClockRunning(clock.path, running)}>
						{running ? '⏸' : '▶'}
					</button>
					<span class="clock-label">{clock.path.length > 0 ? clock.path.join(' › ') : 'clock'}</span
					>
					<input
						type="range"
						min="20"
						max="3000"
						step="10"
						value={periodMs}
						oninput={(e) =>
							setClockPeriod(clock.path, Number((e.target as HTMLInputElement).value))}
					/>
					<span class="clock-speed">{periodMs} ms</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.circuit-canvas {
		display: inline-flex;
		flex-direction: column;
		gap: 8px;
		font-family: -apple-system, 'Segoe UI', sans-serif;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	canvas {
		background: #1b1e24;
		border-radius: 8px;
		cursor: grab;
		touch-action: none;
	}
	canvas.grabbing {
		cursor: grabbing;
	}
	.breadcrumb {
		font-size: 13px;
		color: #8b8f99;
	}
	.breadcrumb .sep {
		margin: 0 4px;
	}
	.breadcrumb button {
		background: none;
		border: none;
		color: #6ea8ff;
		cursor: pointer;
		padding: 0;
		font-size: 13px;
		text-decoration: underline;
	}
	.breadcrumb button:disabled {
		color: #565a63;
		cursor: default;
		text-decoration: none;
	}
	.zoom-controls {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #8b8f99;
	}
	.zoom-controls button {
		background: #252932;
		border: 1px solid #3c414d;
		color: #d8dae0;
		border-radius: 6px;
		width: 24px;
		height: 22px;
		cursor: pointer;
		font-size: 13px;
		line-height: 1;
	}
	.zoom-controls button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.zoom-controls button[title='Reset view'] {
		width: auto;
		padding: 0 8px;
		font-size: 11px;
	}
	.zoom-level {
		min-width: 38px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.clocks {
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: #1b1e24;
		border-radius: 8px;
		padding: 10px 14px;
	}
	.clock-row {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 12px;
		color: #d8dae0;
	}
	.play-pause {
		background: #252932;
		border: 1px solid #3c414d;
		color: #d8dae0;
		border-radius: 6px;
		width: 28px;
		height: 24px;
		cursor: pointer;
		font-size: 11px;
	}
	.clock-label {
		min-width: 90px;
		color: #8b8f99;
	}
	.clock-speed {
		min-width: 55px;
		text-align: right;
		color: #8b8f99;
		font-variant-numeric: tabular-nums;
	}
	input[type='range'] {
		flex: 1;
	}
</style>
