import { LogicValue, emptyLibrary, registerDefinition } from './model/component';
import { evaluateTick, evaluateAtPath, instantiate, type PinChange } from './controller/engine';
import { findInstancesByDefinition } from './model/tree';
import { displayValue as L } from './util/bit';
import {
	AND2,
	OR2,
	NOT,
	NAND2,
	DFF,
	CLOCK,
	VCC,
	GND,
	TRI_BUFFER,
	createBus,
} from '#components/primitives';
import { SR_LATCH, D_LATCH, DFF_GATES } from '#components/composites/latches';
import COUNTER_4BIT_RAW from '#examples/counter4bit.json';
import {
	componentDefinitionSchema,
	type ComponentInstance,
	type CompositeDefinition,
	type DefinitionLibrary,
} from '$lib/schemas/circuit';
import { SEVEN_SEGMENT_DISPLAY } from '../components/composites/displays';
import { SEVEN_SEGMENT_HEX_DECODER } from '../components/composites/eeproms';
const COUNTER_4BIT = componentDefinitionSchema.parse(COUNTER_4BIT_RAW);
// Half adder is only needed for this demo, so it's defined locally rather
// than as a reusable file under components/composites.
const HALF_ADDER: CompositeDefinition = {
	kind: 'composite',
	id: 'HALF_ADDER',
	name: 'Half adder',
	inputs: [
		{ id: 'A', name: 'A' },
		{ id: 'B', name: 'B' },
	],
	outputs: [
		{ id: 'SUM', name: 'SUM' },
		{ id: 'CARRY', name: 'CARRY' },
	],
	children: [
		{ instanceId: 'g1_and', definitionId: 'AND2' },
		{ instanceId: 'g2_or', definitionId: 'OR2' },
		{ instanceId: 'g3_not', definitionId: 'NOT' },
		{ instanceId: 'g4_and', definitionId: 'AND2' },
	],
	internalWires: [
		{
			from: { component: 'self', pinId: 'A' },
			to: [
				{ component: 'g1_and', pinId: 'A' },
				{ component: 'g2_or', pinId: 'A' },
			],
		},
		{
			from: { component: 'self', pinId: 'B' },
			to: [
				{ component: 'g1_and', pinId: 'B' },
				{ component: 'g2_or', pinId: 'B' },
			],
		},
		{
			from: { component: 'g1_and', pinId: 'OUT' },
			to: [
				{ component: 'self', pinId: 'CARRY' },
				{ component: 'g3_not', pinId: 'A' },
			],
		},
		{
			from: { component: 'g2_or', pinId: 'OUT' },
			to: [{ component: 'g4_and', pinId: 'A' }],
		},
		{
			from: { component: 'g3_not', pinId: 'OUT' },
			to: [{ component: 'g4_and', pinId: 'B' }],
		},
		{
			from: { component: 'g4_and', pinId: 'OUT' },
			to: [{ component: 'self', pinId: 'SUM' }],
		},
	],
};

let lib: DefinitionLibrary = emptyLibrary;
for (const def of [
	AND2,
	OR2,
	NOT,
	NAND2,
	DFF,
	CLOCK,
	VCC,
	GND,
	SEVEN_SEGMENT_HEX_DECODER,
	SEVEN_SEGMENT_DISPLAY,
	SR_LATCH,
	D_LATCH,
	DFF_GATES,
	COUNTER_4BIT,
	HALF_ADDER,
]) {
	lib = registerDefinition(lib, def);
}

console.log('== Half adder truth table ==');
let adder = instantiate(lib, 'HALF_ADDER', 'adder1');
for (const [a, b] of [
	[LogicValue.LOW, LogicValue.LOW],
	[LogicValue.HIGH, LogicValue.LOW],
	[LogicValue.LOW, LogicValue.HIGH],
	[LogicValue.HIGH, LogicValue.HIGH],
] as const) {
	const changes: PinChange[] = [
		{ ref: { component: 'self', pinId: 'A' }, value: a },
		{ ref: { component: 'self', pinId: 'B' }, value: b },
	];
	adder = evaluateTick(lib, adder, changes);
	console.log(
		`A=${L(a)} B=${L(b)} -> SUM=${L(adder.pinValues['SUM'])} CARRY=${L(adder.pinValues['CARRY'])}`,
	);
}

console.log('\n== primitives/dff.ts vs composites/latches/dff.ts (DFF_GATES) ==');
let handCoded = instantiate(lib, 'DFF', 'd1');
let gateBuilt = instantiate(lib, 'DFF_GATES', 'd2');

function step(d: LogicValue, clk: LogicValue) {
	const changes: PinChange[] = [
		{ ref: { component: 'self', pinId: 'D' }, value: d },
		{ ref: { component: 'self', pinId: 'CLK' }, value: clk },
	];
	handCoded = evaluateTick(lib, handCoded, changes);
	gateBuilt = evaluateTick(lib, gateBuilt, changes);
	const hcQ = handCoded.pinValues['Q'];
	const gbQ = gateBuilt.pinValues['Q'];
	console.log(
		`D=${L(d)} CLK=${L(clk)} -> fast Q=${L(hcQ)}  gates Q=${L(gbQ)}  [${hcQ === gbQ ? 'match' : 'MISMATCH'}]`,
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
		inputs: [{ id: 'D', name: 'D' }],
		outputs: [{ id: 'Q', name: 'Q' }],
		children: [
			{ instanceId: 'clock', definitionId: 'CLOCK' },
			{ instanceId: 'dff', definitionId: 'DFF_GATES' },
		],
		internalWires: [
			{ from: { component: 'self', pinId: 'D' }, to: [{ component: 'dff', pinId: 'D' }] },
			{
				from: { component: 'clock', pinId: 'CLK' },
				to: [{ component: 'dff', pinId: 'CLK' }],
			},
			{ from: { component: 'dff', pinId: 'Q' }, to: [{ component: 'self', pinId: 'Q' }] },
		],
	};
	const clockedLib = registerDefinition(lib, CLOCKED_DEMO);
	let root = instantiate(clockedLib, 'CLOCKED_DFF_DEMO', 'root');
	root = evaluateTick(clockedLib, root, [
		{ ref: { component: 'self', pinId: 'D' }, value: LogicValue.HIGH },
	]);

	const [{ path: clockPath }] = findInstancesByDefinition(root, 'CLOCK');
	root = evaluateAtPath(clockedLib, root, clockPath, [
		{ ref: { component: 'self', pinId: 'EN' }, value: LogicValue.HIGH },
	]);

	let lastQ = root.pinValues['Q'];
	const start = Date.now();
	while (Date.now() - start < 1600) {
		const en = root.children!['clock'].pinValues['EN'];
		root = evaluateAtPath(clockedLib, root, clockPath, [
			{ ref: { component: 'self', pinId: 'EN' }, value: en },
		]);
		if (root.pinValues['Q'] !== lastQ) {
			console.log(`  +${Date.now() - start}ms: Q -> ${L(root.pinValues['Q'])}`);
			lastQ = root.pinValues['Q'];
		}
	}
}

console.log('\n== 7-segment hex decoder EEPROM, all 16 digits ==');
{
	let rom = instantiate(lib, 'SEVEN_SEGMENT_HEX_DECODER', 'rom1');
	const letters = 'abcdefg';
	for (let digit = 0; digit < 16; digit++) {
		const changes: PinChange[] = [0, 1, 2, 3].map((i) => ({
			ref: { component: 'self', pinId: `A${i}` },
			value: (digit >> i) & 1 ? LogicValue.HIGH : LogicValue.LOW,
		}));
		changes.push({ ref: { component: 'self', pinId: 'OE_n' }, value: LogicValue.LOW });
		rom = evaluateTick(lib, rom, changes);
		let segs = '';
		for (let i = 0; i < 7; i++)
			segs += rom.pinValues[`D${i}`] === LogicValue.HIGH ? letters[i] : '-';
		console.log(`  ${digit.toString(16).toUpperCase()} -> ${segs}`);
	}
}

console.log('\n== Fully automatic counter -> hex decoder -> display (runs ~2s) ==');
{
	const AUTOMATIC_COUNTER_DISPLAY: CompositeDefinition = {
		kind: 'composite',
		id: 'AUTOMATIC_COUNTER_DISPLAY',
		name: 'Automatic counter + display',
		inputs: [],
		outputs: [],
		children: [
			{ instanceId: 'clock', definitionId: 'CLOCK' },
			{ instanceId: 'counter', definitionId: 'COUNTER_4BIT' },
			{ instanceId: 'rom', definitionId: 'SEVEN_SEGMENT_HEX_DECODER' },
			{ instanceId: 'disp', definitionId: 'SEVEN_SEGMENT_DISPLAY' },
			{ instanceId: 'oeGnd', definitionId: 'GND' }, // ties OE_n low permanently, no switch needed
		],
		internalWires: [
			{
				from: { component: 'clock', pinId: 'CLK' },
				to: [{ component: 'counter', pinId: 'CLK' }],
			},
			{
				from: { component: 'counter', pinId: 'Q0' },
				to: [{ component: 'rom', pinId: 'A0' }],
			},
			{
				from: { component: 'counter', pinId: 'Q1' },
				to: [{ component: 'rom', pinId: 'A1' }],
			},
			{
				from: { component: 'counter', pinId: 'Q2' },
				to: [{ component: 'rom', pinId: 'A2' }],
			},
			{
				from: { component: 'counter', pinId: 'Q3' },
				to: [{ component: 'rom', pinId: 'A3' }],
			},
			{
				from: { component: 'oeGnd', pinId: 'OUT' },
				to: [{ component: 'rom', pinId: 'OE_n' }],
			},
			{
				from: { component: 'rom', pinId: 'D0' },
				to: [{ component: 'disp', pinId: 'a' }],
			},
			{
				from: { component: 'rom', pinId: 'D1' },
				to: [{ component: 'disp', pinId: 'b' }],
			},
			{
				from: { component: 'rom', pinId: 'D2' },
				to: [{ component: 'disp', pinId: 'c' }],
			},
			{
				from: { component: 'rom', pinId: 'D3' },
				to: [{ component: 'disp', pinId: 'd' }],
			},
			{
				from: { component: 'rom', pinId: 'D4' },
				to: [{ component: 'disp', pinId: 'e' }],
			},
			{
				from: { component: 'rom', pinId: 'D5' },
				to: [{ component: 'disp', pinId: 'f' }],
			},
			{
				from: { component: 'rom', pinId: 'D6' },
				to: [{ component: 'disp', pinId: 'g' }],
			},
		],
	};

	const acLib = registerDefinition(lib, AUTOMATIC_COUNTER_DISPLAY);
	let root = instantiate(acLib, 'AUTOMATIC_COUNTER_DISPLAY', 'root');
	console.log(
		'  ROM OE_n tied low with no switch:',
		root.children!['rom'].pinValues['OE_n'] === LogicValue.LOW ? 'confirmed' : 'BROKEN',
	);

	const [{ path: clockPath }] = findInstancesByDefinition(root, 'CLOCK');
	root = evaluateAtPath(acLib, root, clockPath, [
		{ ref: { component: 'self', pinId: 'EN' }, value: LogicValue.HIGH },
	]);

	const segToDigit = (disp: ComponentInstance) => {
		const key = 'abcdefg'
			.split('')
			.map((s) => (disp.pinValues[s] === LogicValue.HIGH ? '1' : '0'))
			.join('');
		const table: Record<string, string> = {
			'1111110': '0',
			'0110000': '1',
			'1101101': '2',
			'1111001': '3',
			'0110011': '4',
			'1011011': '5',
			'1011111': '6',
			'1110000': '7',
			'1111111': '8',
			'1111011': '9',
			'1110111': 'A',
			'0011111': 'b',
			'1001110': 'C',
			'0111101': 'd',
			'1001111': 'E',
			'1000111': 'F',
		};
		return table[key] ?? '?';
	};

	let last = segToDigit(root.children!['disp']);
	const trace: string[] = [last];
	const start = Date.now();
	while (Date.now() - start < 2000) {
		const en = root.children!['clock'].pinValues['EN'];
		root = evaluateAtPath(acLib, root, clockPath, [
			{ ref: { component: 'self', pinId: 'EN' }, value: en },
		]);
		const digit = segToDigit(root.children!['disp']);
		if (digit !== last) {
			trace.push(digit);
			last = digit;
		}
	}
	console.log(' ', trace.join(' '));
}

console.log('\n== Shared bus: two tri-state drivers, one line ==');
{
	const BUS2 = createBus({ id: 'BUS2', name: 'Bus (2 drivers)', driverCount: 2 });
	const SHARED_BUS_DEMO: CompositeDefinition = {
		kind: 'composite',
		id: 'SHARED_BUS_DEMO',
		name: 'Shared bus demo',
		inputs: [
			{ id: 'A', name: 'A' },
			{ id: 'EN_A', name: 'EN_A' },
			{ id: 'B', name: 'B' },
			{ id: 'EN_B', name: 'EN_B' },
		],
		outputs: [{ id: 'BUS_OUT', name: 'BUS_OUT' }],
		children: [
			{ instanceId: 'bufA', definitionId: 'TRI_BUFFER' },
			{ instanceId: 'bufB', definitionId: 'TRI_BUFFER' },
			{ instanceId: 'bus', definitionId: 'BUS2' },
		],
		internalWires: [
			{
				from: { component: 'self', pinId: 'A' },
				to: [{ component: 'bufA', pinId: 'A' }],
			},
			{
				from: { component: 'self', pinId: 'EN_A' },
				to: [{ component: 'bufA', pinId: 'EN' }],
			},
			{
				from: { component: 'self', pinId: 'B' },
				to: [{ component: 'bufB', pinId: 'A' }],
			},
			{
				from: { component: 'self', pinId: 'EN_B' },
				to: [{ component: 'bufB', pinId: 'EN' }],
			},
			{
				from: { component: 'bufA', pinId: 'OUT' },
				to: [{ component: 'bus', pinId: 'D0' }],
			},
			{
				from: { component: 'bufB', pinId: 'OUT' },
				to: [{ component: 'bus', pinId: 'D1' }],
			},
			{
				from: { component: 'bus', pinId: 'OUT' },
				to: [{ component: 'self', pinId: 'BUS_OUT' }],
			},
		],
	};
	let lib2 = registerDefinition(registerDefinition(emptyLibrary, TRI_BUFFER), BUS2);
	lib2 = registerDefinition(lib2, SHARED_BUS_DEMO);

	let inst = instantiate(lib2, 'SHARED_BUS_DEMO', 'demo1');
	const set = (a: LogicValue, enA: LogicValue, b: LogicValue, enB: LogicValue) =>
		evaluateTick(lib2, inst, [
			{ ref: { component: 'self', pinId: 'A' }, value: a },
			{ ref: { component: 'self', pinId: 'EN_A' }, value: enA },
			{ ref: { component: 'self', pinId: 'B' }, value: b },
			{ ref: { component: 'self', pinId: 'EN_B' }, value: enB },
		]);

	inst = set(LogicValue.HIGH, LogicValue.HIGH, LogicValue.LOW, LogicValue.LOW);
	console.log(`  Only A enabled -> BUS_OUT = ${L(inst.pinValues['BUS_OUT'])}`);
	inst = set(LogicValue.HIGH, LogicValue.LOW, LogicValue.LOW, LogicValue.HIGH);
	console.log(`  Only B enabled -> BUS_OUT = ${L(inst.pinValues['BUS_OUT'])}`);
	inst = set(LogicValue.HIGH, LogicValue.LOW, LogicValue.LOW, LogicValue.LOW);
	console.log(`  Neither enabled -> BUS_OUT = ${L(inst.pinValues['BUS_OUT'])} (floating)`);
	try {
		inst = set(LogicValue.HIGH, LogicValue.HIGH, LogicValue.LOW, LogicValue.HIGH);
		console.log('  Both enabled with disagreeing values -> should have thrown, DID NOT (bug)');
	} catch (e) {
		console.log(
			`  Both enabled with disagreeing values -> correctly caught: "${(e as Error).message}"`,
		);
	}
}
