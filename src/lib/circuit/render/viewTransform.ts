// Pure view-transform math for canvas pan/zoom. Deliberately has no DOM or
// canvas dependency — event handling lives in CircuitCanvas.svelte, this
// module just answers "given the current transform and an interaction,
// what's the new transform" and "given a screen point, what world point is
// under it," both as plain functions that are easy to get exactly right in
// isolation before wiring them into mouse/wheel event handlers.

export interface ViewTransform {
	readonly scale: number;
	readonly offsetX: number;
	readonly offsetY: number;
}

export const DEFAULT_VIEW_TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

export const MIN_SCALE = 0.3;
export const MAX_SCALE = 3;

export function clampScale(scale: number): number {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

// Converts a point in canvas-element pixel space (e.g. from a mouse event,
// relative to the canvas's bounding rect) into "world" space — the plain
// coordinate system computeLayout's boxes and pins are defined in, before
// any pan/zoom is applied.
export function screenToWorld(
	view: ViewTransform,
	screenX: number,
	screenY: number
): { x: number; y: number } {
	return {
		x: (screenX - view.offsetX) / view.scale,
		y: (screenY - view.offsetY) / view.scale
	};
}

// Returns a new transform with `factor` applied to the zoom level, chosen
// so that whatever world point currently sits under (screenX, screenY)
// stays under it after the zoom — i.e. zooming toward the cursor rather
// than toward the canvas origin. Returns the identical transform (same
// reference) if already at a zoom limit, so callers can cheaply detect a
// no-op.
export function zoomAt(
	view: ViewTransform,
	screenX: number,
	screenY: number,
	factor: number
): ViewTransform {
	const newScale = clampScale(view.scale * factor);
	if (newScale === view.scale) return view;
	const worldBefore = screenToWorld(view, screenX, screenY);
	return {
		scale: newScale,
		offsetX: screenX - worldBefore.x * newScale,
		offsetY: screenY - worldBefore.y * newScale
	};
}

export function pan(view: ViewTransform, dx: number, dy: number): ViewTransform {
	return { ...view, offsetX: view.offsetX + dx, offsetY: view.offsetY + dy };
}
