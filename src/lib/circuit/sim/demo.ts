import {
	LogicValue,
	type CompositeDefinition,
	type DefinitionLibrary,
	emptyLibrary,
	registerDefinition,
	instantiate
} from './model/component';
import { evaluateTick, evaluateAtPath, type PinChange } from './controller/engine';
import { findInstancesByDefinition } from './model/tree';
import { displayValue as L } from './util/bit';
import { AND2, OR2, NOT, NAND2, DFF, CLOCK } from '#components/primitives';
import { SR_LATCH, D_LATCH, DFF_GATES } from '#components/composites/latches';

// Half adder is only needed for this demo, so it's defined locally rather
// than as a reusable file under components/composites.
const HALF_ADDER: CompositeDefinition = {
	kind: 'composite',
	id: 'HALF_ADDER',
	name: 'Half adder',
	inputs: [
		{ id: 'A', name: 'A', direction: 'input' },
		{ id: 'B', name: 'B', direction: 'input' }
	],
	outputs: [
		{ id: 'SUM', name: 'SUM', direction: 'output' },
		{ id: 'CARRY', name: 'CARRY', direction: 'output' }
	],
	children: [
		{ instanceId: 'g1_and', definitionId: 'AND2' },
		{ instanceId: 'g2_or', definitionId: 'OR2' },
		{ instanceId: 'g3_not', definitionId: 'NOT' },
		{ instanceId: 'g4_and', definitionId: 'AND2' }
	],
	internalWires: [
		{
			id: 'w1',
			from: { component: 'self', pinId: 'A' },
			to: [
				{ component: 'g1_and', pinId: 'A' },
				{ component: 'g2_or', pinId: 'A' }
			]
		},
		{
			id: 'w2',
			from: { component: 'self', pinId: 'B' },
			to: [
				{ component: 'g1_and', pinId: 'B' },
				{ component: 'g2_or', pinId: 'B' }
			]
		},
		{
			id: 'w3',
			from: { component: 'g1_and', pinId: 'OUT' },
			to: [
				{ component: 'self', pinId: 'CARRY' },
				{ component: 'g3_not', pinId: 'A' }
			]
		},
		{
			id: 'w4',
			from: { component: 'g2_or', pinId: 'OUT' },
			to: [{ component: 'g4_and', pinId: 'A' }]
		},
		{
			id: 'w5',
			from: { component: 'g3_not', pinId: 'OUT' },
			to: [{ component: 'g4_and', pinId: 'B' }]
		},
		{
			id: 'w6',
			from: { component: 'g4_and', pinId: 'OUT' },
			to: [{ component: 'self', pinId: 'SUM' }]
		}
	]
};

let lib: DefinitionLibrary = emptyLibrary;
for (const def of [AND2, OR2, NOT, NAND2, DFF, CLOCK, SR_LATCH, D_LATCH, DFF_GATES, HALF_ADDER]) {
	lib = registerDefinition(lib, def);
}

console.log('== Half adder truth table ==');
let adder = instantiate(lib, 'HALF_ADDER', 'adder1');
for (const [a, b] of [
	[LogicValue.LOW, LogicValue.LOW],
	[LogicValue.HIGH, LogicValue.LOW],
	[LogicValue.LOW, LogicValue.HIGH],
	[LogicValue.HIGH, LogicValue.HIGH]
] as const) {
	const changes: PinChange[] = [
		{ ref: { component: 'self', pinId: 'A' }, value: a },
		{ ref: { component: 'self', pinId: 'B' }, value: b }
	];
	adder = evaluateTick(lib, adder, changes);
	console.log(
		`A=${L(a)} B=${L(b)} -> SUM=${L(adder.pinValues['SUM'])} CARRY=${L(adder.pinValues['CARRY'])}`
	);
}

console.log('\n== primitives/dff.ts vs composites/latches/dff.ts (DFF_GATES) ==');
let handCoded = instantiate(lib, 'DFF', 'd1');
let gateBuilt = instantiate(lib, 'DFF_GATES', 'd2');

function step(d: LogicValue, clk: LogicValue) {
	const changes: PinChange[] = [
		{ ref: { component: 'self', pinId: 'D' }, value: d },
		{ ref: { component: 'self', pinId: 'CLK' }, value: clk }
	];
	handCoded = evaluateTick(lib, handCoded, changes);
	gateBuilt = evaluateTick(lib, gateBuilt, changes);
	const hcQ = handCoded.pinValues['Q'];
	const gbQ = gateBuilt.pinValues['Q'];
	console.log(
		`D=${L(d)} CLK=${L(clk)} -> fast Q=${L(hcQ)}  gates Q=${L(gbQ)}  [${hcQ === gbQ ? 'match' : 'MISMATCH'}]`
	);
}

step(LogicValue.HIGH, LogicValue.LOW);
step(LogicValue.HIGH, LogicValue.HIGH);
step(LogicValue.LOW, LogicValue.HIGH);
step(LogicValue.LOW, LogicValue.LOW);
step(LogicValue.LOW, LogicValue.HIGH);

console.log('\n== Clock driving a DFF over real time (500ms period, runs for ~1.6s) ==');
{
	const CLOCKED_DEMO: CompositeDefinition = {
		kind: 'composite',
		id: 'CLOCKED_DFF_DEMO',
		name: 'Clocked DFF demo',
		inputs: [{ id: 'D', name: 'D', direction: 'input' }],
		outputs: [{ id: 'Q', name: 'Q', direction: 'output' }],
		children: [
			{ instanceId: 'clock', definitionId: 'CLOCK' },
			{ instanceId: 'dff', definitionId: 'DFF_GATES' }
		],
		internalWires: [
			{ id: 'w1', from: { component: 'self', pinId: 'D' }, to: [{ component: 'dff', pinId: 'D' }] },
			{
				id: 'w2',
				from: { component: 'clock', pinId: 'CLK' },
				to: [{ component: 'dff', pinId: 'CLK' }]
			},
			{ id: 'w3', from: { component: 'dff', pinId: 'Q' }, to: [{ component: 'self', pinId: 'Q' }] }
		]
	};
	const clockedLib = registerDefinition(lib, CLOCKED_DEMO);
	let root = instantiate(clockedLib, 'CLOCKED_DFF_DEMO', 'root');
	root = evaluateTick(clockedLib, root, [
		{ ref: { component: 'self', pinId: 'D' }, value: LogicValue.HIGH }
	]);

	const [{ path: clockPath }] = findInstancesByDefinition(root, 'CLOCK');
	root = evaluateAtPath(clockedLib, root, clockPath, [
		{ ref: { component: 'self', pinId: 'EN' }, value: LogicValue.HIGH }
	]);

	let lastQ = root.pinValues['Q'];
	const start = Date.now();
	while (Date.now() - start < 1600) {
		const en = root.children!['clock'].pinValues['EN'];
		root = evaluateAtPath(clockedLib, root, clockPath, [
			{ ref: { component: 'self', pinId: 'EN' }, value: en }
		]);
		if (root.pinValues['Q'] !== lastQ) {
			console.log(`  +${Date.now() - start}ms: Q -> ${L(root.pinValues['Q'])}`);
			lastQ = root.pinValues['Q'];
		}
	}
}
