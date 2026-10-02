// Netlist: turns a composite's wires into nets (sets of electrically
// connected pins). A wire is no longer "from -> to"; every pin it mentions is
// simply a member of the same net. Two wires that share a pin merge into one
// net automatically, exactly like real wire.
//
// Each member is classified from the *net's* point of view:
//   drives - it can put a value onto the net
//   sinks  - it wants to be told the net's value
//
//                       drives   sinks
//   child  input         no       yes
//   child  output        yes      no
//   child  inout         yes      yes
//   self   input         yes      no    (outside world drives into the inside)
//   self   output        no       yes   (inside drives out to the world)
//   self   inout         yes      yes

import type {
	ComponentDefinition,
	CompositeDefinition,
	DefinitionLibrary,
	PinRef,
} from '$lib/schemas/circuit';
import { getDefinition } from './component';
import { v4 as uuid } from 'uuid';

export type PinKind = 'input' | 'output' | 'inout';

export interface NetMember {
	readonly ref: PinRef;
	readonly kind: PinKind; // as declared on the owning definition
	readonly drives: boolean;
	readonly sinks: boolean;
}

export interface Net {
	readonly members: readonly NetMember[];
}

export interface Netlist {
	readonly nets: readonly Net[];
	readonly netOfPin: ReadonlyMap<string, number>;
	readonly netOfWire: ReadonlyMap<string, number>; // wire.id -> net index
}

export function netKey(ref: PinRef): string {
	return `${ref.component}:${ref.pinId}`;
}

function pinKindOf(def: ComponentDefinition, pinId: string): PinKind | undefined {
	if (def.inputs.some((p) => p.id === pinId)) return 'input';
	if (def.outputs.some((p) => p.id === pinId)) return 'output';
	if (def.inouts?.some((p) => p.id === pinId)) return 'inout';
	return undefined;
}

function classify(
	lib: DefinitionLibrary,
	def: CompositeDefinition,
	childDefIds: ReadonlyMap<string, string>,
	ref: PinRef,
): NetMember {
	if (ref.component === 'self') {
		const kind = pinKindOf(def, ref.pinId);
		if (!kind)
			throw new Error(`Wire in "${def.id}" references unknown boundary pin "${ref.pinId}"`);
		return { ref, kind, drives: kind !== 'output', sinks: kind !== 'input' };
	}
	const childDefId = childDefIds.get(ref.component);
	if (!childDefId) {
		throw new Error(`Wire in "${def.id}" references unknown child "${ref.component}"`);
	}
	const kind = pinKindOf(getDefinition(lib, childDefId), ref.pinId);
	if (!kind) {
		throw new Error(`Wire in "${def.id}" references unknown pin "${ref.component}:${ref.pinId}"`);
	}
	return { ref, kind, drives: kind !== 'input', sinks: kind !== 'output' };
}

function buildNetlist(lib: DefinitionLibrary, def: CompositeDefinition): Netlist {
	// Union-find over pin keys.
	const parent = new Map<string, string>();
	const refs = new Map<string, PinRef>();

	const find = (k: string): string => {
		let root = k;
		while (parent.get(root)! !== root) root = parent.get(root)!;
		let cur = k;
		while (cur !== root) {
			const next = parent.get(cur)!;
			parent.set(cur, root);
			cur = next;
		}
		return root;
	};
	const add = (ref: PinRef): string => {
		const k = netKey(ref);
		if (!parent.has(k)) {
			parent.set(k, k);
			refs.set(k, ref);
		}
		return k;
	};
	const union = (a: string, b: string) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent.set(rb, ra);
	};

	const wireAnchors: [string, string][] = [];
	for (const wire of def.internalWires) {
		// NOTE: this mutates the definition (as the old engine did). routing.ts
		// relies on wire.id being set, so keep it until ids are assigned at load.
		wire.id = wire.id ?? uuid();
		const first = add(wire.from);
		for (const to of wire.to ?? []) union(first, add(to));
		wireAnchors.push([wire.id, first]);
	}

	const childDefIds = new Map(def.children.map((c) => [c.instanceId, c.definitionId]));

	const groups = new Map<string, NetMember[]>();
	for (const [k, ref] of refs) {
		const root = find(k);
		const member = classify(lib, def, childDefIds, ref);
		const list = groups.get(root);
		if (list) list.push(member);
		else groups.set(root, [member]);
	}

	const nets: Net[] = [];
	const netOfPin = new Map<string, number>();
	const rootIndex = new Map<string, number>();
	for (const [root, members] of groups) {
		const index = nets.length;
		rootIndex.set(root, index);
		nets.push({ members });
		for (const m of members) netOfPin.set(netKey(m.ref), index);
	}

	const netOfWire = new Map<string, number>();
	for (const [id, anchor] of wireAnchors) netOfWire.set(id, rootIndex.get(find(anchor))!);

	return { nets, netOfPin, netOfWire };
}

const netlistCache = new WeakMap<DefinitionLibrary, Map<string, Netlist>>();

export function getNetlist(lib: DefinitionLibrary, def: CompositeDefinition): Netlist {
	let libCache = netlistCache.get(lib);
	if (!libCache) {
		libCache = new Map();
		netlistCache.set(lib, libCache);
	}
	let netlist = libCache.get(def.id);
	if (!netlist) {
		netlist = buildNetlist(lib, def);
		libCache.set(def.id, netlist);
	}
	return netlist;
}
