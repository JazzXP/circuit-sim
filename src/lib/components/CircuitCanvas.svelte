<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { findInstancesByDefinition, updateInstanceStateAtPath } from '#sim/model/tree';
	import { findStateProblems } from '#sim/model/diagnostics';
	import {
		evaluateTick,
		evaluateAtPath,
		instantiate,
		type PinChange,
	} from '#sim/controller/engine';
	import type { TimerState } from '#components/primitives/timer';
	import { computeLayout } from '#render/layout';
	import { renderComposite, type ClickRegion } from '#render/canvasRenderer';
	import type { SevenSegmentFade } from '#render/sevenSegment';
	import {
		DEFAULT_VIEW_TRANSFORM,
		screenToWorld,
		zoomAt,
		pan,
		type ViewTransform,
	} from '#render/viewTransform';
	import { LogicValue, getDefinition, inoutPins } from '#circuit/sim/model/component';
	import type { DefinitionLibrary, ComponentInstance, PinRef } from '$lib/schemas/circuit';
	import { browser } from '$app/env';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	interface Props {
		library: DefinitionLibrary;
		rootDefinitionId: string;
		width?: number;
		height?: number;
	}

	let { library, rootDefinitionId, width: totalWidth = 720, height = 320 }: Props = $props();

	let canvasEl: HTMLCanvasElement;

	// Fit once per drill level / canvas size, after its layout has been routed.
	// zoomToFit() reads rootInstance (which pollClocks replaces every POLL_MS
	// while any clock exists), so it MUST run untracked and be guarded by a key —
	// otherwise every clock tick re-fits and throws away the user's zoom/pan.
	let lastFitKey = '';
	$effect(() => {
		const key = `${drillPath.join('.')}|${layoutKey}`;
		if (loadingStatus !== null) return;
		if (!preparedLayouts.has(layoutKey)) return;
		if (key === lastFitKey) return;
		lastFitKey = key;
		untrack(() => zoomToFit());
	});

	// Root inputs start LOW rather than UNKNOWN. Routing this through
	// evaluateTick means everything downstream settles from those values.
	// Root inouts are left floating (HIGH_Z) so they aren't forced to drive.
	function createRootInstance(): ComponentInstance {
		const fresh = instantiate(library, rootDefinitionId, 'root');
		const def = getDefinition(library, rootDefinitionId);
		return evaluateTick(
			library,
			fresh,
			def.inputs.map((pin) => ({
				ref: { component: 'self' as const, pinId: pin.id },
				value: LogicValue.LOW,
			})),
		);
	}

	let rootInstance = $state.raw<ComponentInstance>(createRootInstance());
	let errorMessage = $derived<string | null>(checkForProblems(rootInstance));

	function describeError(e: unknown): string {
		return e instanceof Error ? e.message : String(e);
	}

	// Runs AFTER a full evaluateTick/evaluateAtPath call has already
	// returned — i.e. on an already-settled instance — never mid-
	// propagation. See sim/model/diagnostics.ts for why that distinction
	// matters: checking during propagation would flag entirely normal,
	// unavoidable transient states as if they were real wiring bugs.
	function checkForProblems(instance: ComponentInstance): string | null {
		const problems = findStateProblems(library, instance);
		if (problems.length === 0) return null;
		return problems
			.map((p) => (p.path.length > 0 ? `${p.path.join('.')}: ${p.message}` : p.message))
			.join('; ');
	}
	let drillPath = $state<string[]>([]);
	let clickRegions: ClickRegion[] = [];
	let view = $state<ViewTransform>(DEFAULT_VIEW_TRANSFORM);

	// --- Loading status ------------------------------------------------
	//
	// The first time a level is drawn at a given size, computeLayout has to
	// route every wire (grid A*), which can block the main thread for a
	// noticeable moment on bigger circuits. Results are cached inside
	// computeLayout, so this only happens once per level/size. To let a
	// status message actually paint before that blocking work starts, the
	// work is deferred by a frame and the canvas shows an overlay meanwhile.
	let loadingStatus = $state<string | null>(null);
	const preparedLayouts = new SvelteSet<string>();

	// Resolves only AFTER the browser has actually painted the current DOM.
	// requestAnimationFrame alone isn't enough: its callback runs *before*
	// the frame is painted, so blocking work started there would freeze the
	// page before the status message ever appeared. The setTimeout inside it
	// runs after that paint has happened.
	function waitForPaint(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
	}

	async function prepareLayout(definitionId: string, layoutKey: string) {
		if (width <= 0 || height <= 0) return;
		loadingStatus = 'Routing wires…';
		await waitForPaint();
		try {
			computeLayout(library, definitionId, width, height);
			preparedLayouts.add(layoutKey);
		} catch (e) {
			errorMessage = describeError(e);
			preparedLayouts.add(layoutKey); // don't retry in a loop; the error banner explains
		}
		loadingStatus = null;
	}

	// The root's own boundary pins that the person can drive. These live in
	// the toolbar (not just on the canvas) so they stay reachable while
	// drilled into a sub-circuit.
	let rootDef = $derived(getDefinition(library, rootDefinitionId));
	let rootInputs = $derived(rootDef.inputs);
	let rootInouts = $derived(inoutPins(rootDef));

	// `totalWidth` (the prop) is the width of the whole component. When
	// there are root pins, a fixed-width column of toggle buttons sits to the
	// left of the canvas, and the canvas shrinks by the same amount so the
	// overall footprint doesn't change. Everything below that used `width`
	// keeps meaning "the canvas's width".
	const SIDEBAR_WIDTH = 120;
	const SIDEBAR_GAP = 8;
	let hasRootPins = $derived(rootInputs.length > 0 || rootInouts.length > 0);
	let width = $derived(hasRootPins ? totalWidth - SIDEBAR_WIDTH - SIDEBAR_GAP : totalWidth);

	// Every CLOCK instance anywhere in the tree, regardless of nesting depth —
	// recomputed whenever the tree changes so newly-drilled-into clocks (or
	// ones a future design might add dynamically) are picked up automatically.
	let clocks = $derived([
		...findInstancesByDefinition(rootInstance, 'CLOCK'),
		...findInstancesByDefinition(rootInstance, 'OUTPUT_TIMER'),
	]);

	function instanceAtPath(path: string[]): ComponentInstance {
		let current = rootInstance;
		for (const id of path) current = current.children![id];
		return current;
	}

	function pinValueLabel(v: LogicValue | undefined): string {
		if (v === LogicValue.HIGH) return '1';
		if (v === LogicValue.LOW) return '0';
		if (v === LogicValue.HIGH_Z) return 'Z';
		return 'X';
	}

	function pinValueClass(v: LogicValue | undefined): string {
		if (v === LogicValue.HIGH) return 'high';
		if (v === LogicValue.LOW) return 'low';
		if (v === LogicValue.HIGH_Z) return 'floating';
		return 'unknown';
	}

	function toggleRootInput(pinId: string) {
		const current = rootInstance.pinValues[pinId];
		const isInout = rootInouts.some((p) => p.id === pinId);
		let next: LogicValue;
		if (isInout) {
			// Bidirectional pins can be driven low, driven high, or left
			// floating for the circuit to drive: cycle Z -> 0 -> 1 -> Z.
			if (current === LogicValue.LOW) next = LogicValue.HIGH;
			else if (current === LogicValue.HIGH) next = LogicValue.HIGH_Z;
			else next = LogicValue.LOW;
		} else {
			next = current === LogicValue.HIGH ? LogicValue.LOW : LogicValue.HIGH;
		}
		const change: PinChange = { ref: { component: 'self', pinId }, value: next };
		try {
			// evaluateTick's own functional design means a thrown error here
			// (e.g. an unstable feedback loop hitting the propagation-step
			// limit) never partially mutates rootInstance — it just never gets
			// reassigned, so the circuit stays at its last valid state.
			const settled = evaluateTick(library, rootInstance, [change]);
			rootInstance = settled;
			errorMessage = checkForProblems(settled);
		} catch (e) {
			errorMessage = describeError(e);
		}
	}

	// Drilling into a different level resets the view — the old pan/zoom was
	// specific to that level's layout and generally won't make sense applied
	// to a different composite's content.
	function resetView() {
		view = DEFAULT_VIEW_TRANSFORM;
		errorMessage = checkForProblems(rootInstance);
	}
	function zoomToFit() {
		const instance = instanceAtPath(drillPath);
		const key = `${instance.definitionId}:${width}x${height}`;
		if (!preparedLayouts.has(key)) return; // Don't compute synchronously!
		const layout = computeLayout(library, instance.definitionId, width, height);

		// Collect all coordinate points we want to enclose
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		const consider = (x: number, y: number) => {
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
		};

		// 1. Consider child component bounding boxes
		for (const box of Object.values(layout.children)) {
			consider(box.x, box.y);
			consider(box.x + box.w, box.y + box.h);
		}

		// 2. Consider self input/output pin positions
		for (const p of Object.values(layout.selfInputPos)) consider(p.x, p.y);
		for (const p of Object.values(layout.selfOutputPos)) consider(p.x, p.y);
		for (const p of Object.values(layout.selfInoutPos)) consider(p.x, p.y);

		// 3. Consider wire route points
		for (const route of layout.routes) {
			for (const p of route.points) {
				consider(p.x, p.y);
			}
		}

		// Fallback if the layout is completely empty
		if (minX === Infinity || minY === Infinity) {
			resetView();
			return;
		}

		const contentWidth = maxX - minX;
		const contentHeight = maxY - minY;

		if (contentWidth === 0 || contentHeight === 0) {
			resetView();
			return;
		}

		// Add padding around the edges (e.g., 40px padding)
		const padding = 40;
		const availableWidth = Math.max(width - padding * 2, 10);
		const availableHeight = Math.max(height - padding * 2, 10);

		const scaleX = availableWidth / contentWidth;
		const scaleY = availableHeight / contentHeight;
		const scale = Math.min(scaleX, scaleY, 2); // Cap max zoom-to-fit scale at 2x

		// Center the content in the canvas viewport
		const offsetX = width / 2 - scale * (minX + contentWidth / 2);
		const offsetY = height / 2 - scale * (minY + contentHeight / 2);

		view = { scale, offsetX, offsetY };
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
		try {
			for (const { path, instance } of clocks) {
				const en = instance.pinValues['EN'];
				next = evaluateAtPath(library, next, path, [
					{ ref: { component: 'self', pinId: 'EN' }, value: en },
				]);
			}
			rootInstance = next;
			errorMessage = checkForProblems(next);
		} catch (e) {
			errorMessage = describeError(e);
			// rootInstance intentionally left at its last valid state.
		}
	}

	function toggleClockRunning(path: readonly string[], currentlyRunning: boolean) {
		try {
			const settled = evaluateAtPath(library, rootInstance, path, [
				{
					ref: { component: 'self', pinId: 'EN' },
					value: currentlyRunning ? LogicValue.LOW : LogicValue.HIGH,
				},
			]);
			rootInstance = settled;
			errorMessage = checkForProblems(settled);
		} catch (e) {
			errorMessage = describeError(e);
		}
	}

	function setClockPeriod(path: readonly string[], periodMs: number) {
		rootInstance = updateInstanceStateAtPath(rootInstance, path, (instance) => ({
			...instance,
			primitiveState: { ...(instance.primitiveState as TimerState), periodMs },
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
		if (fadeRaf !== null) cancelAnimationFrame(fadeRaf);
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

	// Per-display 7-segment fade state, keyed by drill path + instance id. The
	// renderer is stateless, so it lives here and survives across frames.
	const fadeStates = new Map<string, SevenSegmentFade>();
	let fadeRaf: number | null = null;

	function draw() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const instance = instanceAtPath(drillPath);
		const layoutKey = `${instance.definitionId}:${width}x${height}`;
		if (!preparedLayouts.has(layoutKey)) {
			// Not routed yet: blank the canvas, show the status, and redraw
			// (via the effect) once loadingStatus clears.
			ctx.clearRect(0, 0, width, height);
			if (!loadingStatus) void prepareLayout(instance.definitionId, layoutKey);
			return;
		}

		ctx.save();
		ctx.clearRect(0, 0, width, height);
		ctx.translate(view.offsetX, view.offsetY);
		ctx.scale(view.scale, view.scale);

		let fading = false;
		try {
			const layout = computeLayout(library, instance.definitionId, width, height);
			const isRoot = drillPath.length === 0;

			clickRegions = renderComposite(ctx, library, instance, layout, {
				interactive: isRoot,
				onToggleInput: toggleRootInput,
				onDrillInto: drillInto,
				fadeStates,
				pathKey: drillPath.join('.'),
				now: performance.now(),
				onAnimating: () => {
					fading = true;
				},
				onProbePin: toggleProbe,
				isProbed: (ref) => traces.has(probeKey(ref)),
			});
		} finally {
			// Always rebalance save(), even if rendering throws, so one bad
			// frame can't leave the context transform stuck.
			ctx.restore();
		}

		// Segments keep fading after the last pin change, but nothing else
		// triggers a redraw then, so keep drawing frames until they settle.
		if (fading && fadeRaf === null) {
			fadeRaf = requestAnimationFrame(() => {
				fadeRaf = null;
				draw();
			});
		}
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
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		loadingStatus;
		draw();
	});

	onMount(draw);

	import { drawScope } from '#render/scope';
	import { inoutDisplayValue } from '#render/canvasRenderer';

	interface Probe {
		key: string;
		label: string;
		path: string[];
		pinId: string;
	}
	interface Sample {
		t: number;
		v: LogicValue;
	}

	const SCOPE_WINDOW_MS = 4000;
	const LANE_H = 44;

	let probes = $state.raw<Probe[]>([]);
	const traces = new SvelteMap<string, Sample[]>(); // plain Map: no reactivity cost

	function probePath(ref: PinRef): string[] {
		return ref.component === 'self' ? [...drillPath] : [...drillPath, ref.component];
	}
	const probeKey = (ref: PinRef) => `${probePath(ref).join('.')}:${ref.pinId}`;

	function readProbe(p: Probe): LogicValue {
		const inst = instanceAtPath(p.path);
		const isInout = inoutPins(getDefinition(library, inst.definitionId)).some(
			(x) => x.id === p.pinId,
		);
		return isInout ? inoutDisplayValue(inst, p.pinId) : inst.pinValues[p.pinId];
	}

	function toggleProbe(ref: PinRef) {
		const key = probeKey(ref);
		if (traces.has(key)) {
			traces.delete(key);
			probes = probes.filter((p) => p.key !== key);
			return;
		}
		const path = probePath(ref);
		const label = [...path, ref.pinId].join('.') || ref.pinId;
		traces.set(key, []);
		probes = [...probes, { key, label, path, pinId: ref.pinId }];
		sampleProbes();
	}

	// Store changes only (like a VCD file); the trace is extended to "now" when drawn.
	function sampleProbes() {
		const now = performance.now();
		for (const p of probes) {
			let v: LogicValue;
			try {
				v = readProbe(p);
			} catch {
				continue;
			}
			const tr = traces.get(p.key)!;
			if (tr.length === 0 || tr[tr.length - 1].v !== v) tr.push({ t: now, v });
			while (tr.length > 2 && tr[1].t < now - SCOPE_WINDOW_MS) tr.shift();
		}
	}
	let scopeEl = $state<HTMLCanvasElement>();
	let scopeRaf: number | null = null;

	function scopeFrame() {
		scopeRaf = null;
		const ctx = scopeEl?.getContext('2d');
		if (ctx && scopeEl) {
			sampleProbes(); // also prunes
			drawScope(
				ctx,
				scopeEl.width,
				scopeEl.height,
				probes.map((p) => ({ label: p.label, samples: traces.get(p.key) ?? [] })),
				performance.now(),
				SCOPE_WINDOW_MS,
			);
		}
		if (probes.length > 0) scopeRaf = requestAnimationFrame(scopeFrame);
	}

	$effect(() => {
		if (probes.length > 0 && scopeRaf === null) scopeRaf = requestAnimationFrame(scopeFrame);
	});

	// Every settled state (user toggle or clock poll) produces a new rootInstance.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		rootInstance;
		sampleProbes();
	});
	let layoutKey = $derived(`${instanceAtPath(drillPath).definitionId}:${width}x${height}`);

	$effect(() => {
		const key = layoutKey;
		const instance = instanceAtPath(drillPath);
		if (width > 0 && height > 0 && !preparedLayouts.has(key) && !loadingStatus) {
			void prepareLayout(instance.definitionId, key);
		}
	});
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
			<button onclick={zoomToFit} title="Zoom to fit">Fit</button>
			<button
				onclick={resetView}
				title="Reset view"
				disabled={view.scale === 1 && view.offsetX === 0 && view.offsetY === 0}
			>
				Reset
			</button>
		</div>
	</div>

	{#if errorMessage}
		<div class="error-banner">⚠ {errorMessage}</div>
	{/if}

	<div class="main-row">
		{#if hasRootPins}
			<div
				class="root-pins"
				role="group"
				aria-label="Circuit inputs"
				style="width: {SIDEBAR_WIDTH}px; max-height: {height}px;"
			>
				{#each rootInputs as pin (pin.id)}
					{@const value = rootInstance.pinValues[pin.id]}
					<button
						class="pin-toggle {pinValueClass(value)}"
						onclick={() => toggleRootInput(pin.id)}
						title="Toggle {pin.name}"
					>
						<span class="pin-name">{pin.name}</span>
						<span class="pin-value">{pinValueLabel(value)}</span>
					</button>
				{/each}
				{#each rootInouts as pin (pin.id)}
					{@const value = rootInstance.pinValues[pin.id]}
					<button
						class="pin-toggle inout {pinValueClass(value)}"
						onclick={() => toggleRootInput(pin.id)}
						title="Cycle {pin.name}: floating, 0, 1"
					>
						<span class="pin-name">&#9670; {pin.name}</span>
						<span class="pin-value">{pinValueLabel(value)}</span>
					</button>
				{/each}
			</div>
		{/if}
		<div class="canvas-wrap">
			<canvas
				bind:this={canvasEl}
				{width}
				{height}
				onwheel={handleWheel}
				onmousedown={handleMouseDown}
				class:grabbing={dragging}
				aria-busy={loadingStatus !== null}
			></canvas>
			{#if probes.length > 0}
				<canvas
					class="scope"
					bind:this={scopeEl}
					{width}
					height={Math.min(probes.length * LANE_H, height)}
				></canvas>
			{/if}
			{#if loadingStatus}
				<div class="loading-overlay" role="status" aria-live="polite">
					<span class="spinner"></span>
					<span>{loadingStatus}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if clocks.length > 0}
		<div class="clocks">
			{#each clocks as clock (clock.path.join('.'))}
				{@const running = clock.instance.pinValues['EN'] === LogicValue.HIGH}
				{@const periodMs = (clock.instance.primitiveState as TimerState).periodMs}
				<div class="clock-row">
					<button class="play-pause" onclick={() => toggleClockRunning(clock.path, running)}>
						{running ? '⏸' : '▶'}
					</button>
					<span class="clock-label">{clock.path.length > 0 ? clock.path.join(' › ') : 'clock'}</span
					>
					<input
						type="range"
						min="1"
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
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
	.main-row {
		display: flex;
		align-items: flex-start;
		gap: 8px; /* keep in sync with SIDEBAR_GAP */
	}
	.root-pins {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
		box-sizing: border-box;
		overflow-y: auto;
	}
	.pin-toggle {
		display: flex;
		justify-content: space-between;
		flex-shrink: 0;
		box-sizing: border-box;
		width: 100%;
		align-items: center;
		gap: 6px;
		background: #252932;
		border: 1px solid #3c414d;
		color: #d8dae0;
		border-radius: 6px;
		padding: 2px 8px;
		height: 24px;
		font-size: 11px;
		cursor: pointer;
	}
	.pin-toggle:hover {
		border-color: #565a63;
	}
	.pin-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pin-value {
		min-width: 12px;
		text-align: center;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		border-radius: 4px;
		padding: 0 4px;
		color: #1b1e24;
	}
	.pin-toggle.low .pin-value {
		background: #4a4e58;
		color: #d8dae0;
	}
	.pin-toggle.high .pin-value {
		background: #e0a840;
	}
	.pin-toggle.floating .pin-value {
		background: #6a5a8a;
		color: #d8dae0;
	}
	.pin-toggle.unknown .pin-value {
		background: #d9556b;
		color: #fff;
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
	.canvas-wrap {
		position: relative;
		line-height: 0;
	}
	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-size: 13px;
		line-height: 1.2;
		color: #8b8f99;
		pointer-events: none;
	}
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid #3c414d;
		border-top-color: #6ea8ff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.error-banner {
		background: #3a1f24;
		border: 1px solid #7a3540;
		color: #f4a8b0;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 12px;
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
	.scope {
		position: absolute;
		left: 0;
		bottom: 0;
		pointer-events: none;
		border-radius: 0 0 8px 8px;
	}
</style>
