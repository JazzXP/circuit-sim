import { describe, beforeEach, it, expect } from 'vitest';

import { LogicValue, emptyLibrary, registerDefinition, instantiate } from '#sim/model/component';
import { evaluateTick } from '#sim/controller/engine';
import { AND2, OR2, NOT, NAND2 } from '#components/primitives';
import { SR_LATCH } from './sr-latch';
import { D_LATCH } from './d-latch';
import type { DefinitionLibrary } from '$lib/schemas/circuit';

type TestType = {
	name: string;
	pins: { D: LogicValue; EN: LogicValue };
	expected: { Q: LogicValue; Q_n: LogicValue };
};
// const L = (v: LogicValue) => (v === LogicValue.HIGH ? 'H' : v === LogicValue.LOW ? 'L' : '?');
describe('D-Latch', () => {
	let lib: DefinitionLibrary = emptyLibrary;
	beforeEach(() => {
		for (const def of [AND2, OR2, NOT, NAND2, SR_LATCH, D_LATCH]) {
			lib = registerDefinition(lib, def);
		}
	});

	const testList: TestType[] = [
		{
			name: 'D High',
			pins: { D: LogicValue.HIGH, EN: LogicValue.HIGH },
			expected: { Q: LogicValue.HIGH, Q_n: LogicValue.LOW },
		},
		{
			name: 'D Low',
			pins: { D: LogicValue.LOW, EN: LogicValue.HIGH },
			expected: { Q: LogicValue.LOW, Q_n: LogicValue.HIGH },
		},
		{
			name: 'Disabled D High',
			pins: { D: LogicValue.HIGH, EN: LogicValue.LOW },
			expected: { Q: LogicValue.LOW, Q_n: LogicValue.HIGH },
		},
		{
			name: 'Disabled D Low',
			pins: { D: LogicValue.LOW, EN: LogicValue.LOW },
			expected: { Q: LogicValue.LOW, Q_n: LogicValue.HIGH },
		},
	];

	it('Initial', () => {
		const dLatch = instantiate(lib, D_LATCH.id, 'd1');
		expect(dLatch.pinValues.Q).equals(LogicValue.UNKNOWN);
		expect(dLatch.pinValues.Q_n).equals(LogicValue.UNKNOWN);
	});

	it.each(testList)('$name pins: D:$pins.D EN:$pins.EN', ({ pins, expected }) => {
		const dLatch = instantiate(lib, D_LATCH.id, 'd1');

		const changes = Object.entries(pins).map(([pinId, value]) => ({
			ref: { component: 'self', pinId },
			value,
		}));
		const out = evaluateTick(lib, dLatch, changes);
		Object.entries(expected).forEach(([pinId, value]) => {
			expect(out.pinValues[pinId]).equals(value);
		});
	});
});
