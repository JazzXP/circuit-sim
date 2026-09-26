import type { PinSpec, PrimitiveDefinition } from '$lib/schemas/circuit';

// g=middle.
const SEGMENT_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const;
const DISPLAY_IDS = ['1', '2', '3', '4'];

export const SEVEN_SEGMENT_DISPLAY: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'FOUR_SEVEN_SEGMENT_DISPLAY',
	name: '4 7-Seg Displays',
	inputs: DISPLAY_IDS.flatMap((disp) =>
		SEGMENT_IDS.map((id): PinSpec => ({ id: `${disp}${id}`, name: `${disp}${id}` })),
	),
	outputs: [],
	initialState: () => undefined,
	evaluate: () => ({ outputs: [], nextState: undefined }),
};
