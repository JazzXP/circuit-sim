import { describe, beforeEach, it, expect } from 'vitest';

import {
	LogicValue,
	type DefinitionLibrary,
	emptyLibrary,
	registerDefinition,
	instantiate
} from '#sim/model/component';
import { evaluateTick } from '#sim/controller/engine';
import { AND2, OR2, NOT, NAND2 } from '#components/primitives';
import { SR_LATCH } from './sr-latch.ts';

type TestType = {
	name: string;
	pins: { S: LogicValue; R: LogicValue }[];
	expected: { Q: LogicValue; Q_n: LogicValue }[];
};
describe('SR-Latch', () => {
	let lib: DefinitionLibrary = emptyLibrary;
	beforeEach(() => {
		for (const def of [AND2, OR2, NOT, NAND2, SR_LATCH]) {
			lib = registerDefinition(lib, def);
		}
	});

	const testList: TestType[] = [
		{
			name: 'S High-High No Reset',
			pins: [
				{ S: LogicValue.HIGH, R: LogicValue.LOW },
				{ S: LogicValue.HIGH, R: LogicValue.HIGH }
			],
			expected: [
				{ Q: LogicValue.HIGH, Q_n: LogicValue.LOW },
				{ Q: LogicValue.HIGH, Q_n: LogicValue.LOW }
			]
		}
	];

	it('Initial', () => {
		const srLatch = instantiate(lib, SR_LATCH.id, 'sr1');
		expect(srLatch.pinValues.Q).equals(LogicValue.UNKNOWN);
		expect(srLatch.pinValues.Q_n).equals(LogicValue.UNKNOWN);
	});

	it.each(testList)('$name', ({ pins, expected }) => {
		const srLatch = instantiate(lib, SR_LATCH.id, 'sr1');

		const changes = pins.map((p) =>
			Object.entries(p).map(([pinId, value]) => ({
				ref: { component: 'self', pinId },
				value
			}))
		);
		let sr = srLatch;
		changes.forEach((c, idx) => {
			console.log(c, idx);
			sr = evaluateTick(lib, sr, c);
			Object.entries(expected[idx]).forEach(([pinId, value]) => {
				console.log(pinId, value, sr.pinValues[pinId]);
				expect(sr.pinValues[pinId]).equals(value);
			});
		});
	});
});
