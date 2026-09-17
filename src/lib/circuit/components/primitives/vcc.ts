import { LogicValue } from '#sim/model/component';
import type { PrimitiveDefinition } from '$lib/schemas/circuit';

// Zero-input sources — see the seeding logic in sim/model/component.ts's
// instantiate(): these are evaluated immediately at creation time rather
// than waiting for an event that will never come, exactly like a tied-off
// rail is just always at its voltage from power-on.
export const VCC: PrimitiveDefinition = {
	kind: 'primitive',
	id: 'VCC',
	name: 'VCC',
	inputs: [],
	outputs: [{ id: 'OUT', name: 'OUT', direction: 'output' }],
	initialState: () => undefined,
	evaluate: () => ({ outputs: [LogicValue.HIGH], nextState: undefined }),
};
