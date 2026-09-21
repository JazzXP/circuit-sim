// A physical indicator, not a logic component: it computes nothing and has
// no outputs, so nothing can ever be wired downstream of it. Its only
// purpose is to be drawn — see render/seven-segment-shape.ts — reflecting
// whatever the a-g segment-driver inputs currently are. Segment naming
// matches the convention used in seven-segment-decoder.ts: a=top,
// b=top-right, c=bottom-right, d=bottom, e=bottom-left, f=top-left,

import type { PinSpec, PrimitiveDefinition } from '$lib/schemas/circuit';

// g=middle.
const SEGMENT_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

export const SEVEN_SEGMENT_DISPLAY: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'SEVEN_SEGMENT_DISPLAY',
	name: '7-Seg Display',
	inputs: SEGMENT_IDS.map((id): PinSpec => ({ id, name: id })),
	outputs: [],
	initialState: () => undefined,
	evaluate: () => ({ outputs: [], nextState: undefined }),
};
