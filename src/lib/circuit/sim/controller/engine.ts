// Net-based, event-driven evaluation engine. Pure functions throughout: every
// evaluate* call takes an instance tree and a set of incoming changes, and
// returns a brand new tree plus whatever changed on its own boundary.
//
// Wires are undirected. Inside a composite, connected pins form a net; the
// net's value is the resolution of everything driving it (see resolveDrivers).
// Whenever a net's drivers change, the net is re-resolved and every sink is
// told its new value.
//
// Bidirectional (inout) pins:
//   - An inout pin is both a driver and a sink on its net.
//   - It SEES what everyone ELSE on the net is driving (its own drive is
//     excluded). This is what stops a composite from latching its own output
//     through the boundary.
//   - What it DRIVES is stored separately, in instance.driveValues.
//   - Primitive evaluate() convention: inputs = [...inputs, ...inouts(seen)],
//     outputs = [...outputs, ...inouts(driven)]. Return HIGH_Z to release.
//   - PinChange on an inout means: as an *input* change, the value seen from
//     outside; as an *output* change, the value now being driven outward.

import type {
	ComponentInstance,
	CompositeDefinition,
	DefinitionLibrary,
	PinRef,
	PrimitiveDefinition,
} from '$lib/schemas/circuit';
import {
	LogicValue,
	getDefinition,
	inoutPins,
	evalInputPins,
	allPins,
	resolveDrivers,
} from '../model/component';
import { getNetlist, netKey, type NetMember, type Netlist } from '../model/netlist';

export interface PinChange {
	readonly ref: PinRef; // "self" = this instance's own boundary pin
	readonly value: LogicValue;
}

export interface EvalResult {
	readonly instance: ComponentInstance;
	readonly outputChanges: readonly PinChange[];
}

export function evaluateInstance(
	lib: DefinitionLibrary,
	instance: ComponentInstance,
	inputChanges: readonly PinChange[],
): EvalResult {
	if (inputChanges.length === 0) {
		return { instance, outputChanges: [] };
	}
	const def = getDefinition(lib, instance.definitionId);
	return def.kind === 'primitive'
		? evaluatePrimitiveInstance(def, instance, inputChanges)
		: evaluateCompositeInstance(lib, def, instance, inputChanges);
}

function evaluatePrimitiveInstance(
	def: PrimitiveDefinition,
	instance: ComponentInstance,
	inputChanges: readonly PinChange[],
): EvalResult {
	const pinValues = { ...instance.pinValues };
	const driveValues = { ...instance.driveValues };
	for (const change of inputChanges) pinValues[change.ref.pinId] = change.value;

	const inputArray = evalInputPins(def).map((pin) => pinValues[pin.id]);
	const { outputs, nextState } = def.evaluate(inputArray, instance.primitiveState);

	const outputChanges: PinChange[] = [];
	def.outputs.forEach((pin, i) => {
		const next = outputs?.[i] ?? LogicValue.LOW;
		if (pinValues[pin.id] !== next) {
			pinValues[pin.id] = next;
			outputChanges.push({ ref: { component: 'self', pinId: pin.id }, value: next });
		}
	});
	inoutPins(def).forEach((pin, j) => {
		const next = outputs?.[def.outputs.length + j] ?? LogicValue.HIGH_Z;
		if (driveValues[pin.id] !== next) {
			driveValues[pin.id] = next;
			outputChanges.push({ ref: { component: 'self', pinId: pin.id }, value: next });
		}
	});

	const nextInstance: ComponentInstance = {
		...instance,
		pinValues,
		driveValues,
		primitiveState: nextState,
	};
	return { instance: nextInstance, outputChanges };
}

const MAX_PROPAGATION_STEPS = 10_000;

// Mutable working copies that a propagation pass reads and writes.
interface WorkingState {
	readonly pinValues: Record<string, LogicValue>;
	readonly driveValues: Record<string, LogicValue>;
	readonly children: Record<string, ComponentInstance>;
	readonly netValues: LogicValue[];
}

function workingCopy(instance: ComponentInstance): WorkingState {
	return {
		pinValues: { ...instance.pinValues },
		driveValues: { ...instance.driveValues },
		children: { ...(instance.children ?? {}) },
		netValues: [...(instance.netValues ?? [])],
	};
}

function markDirty(netlist: Netlist, ref: PinRef, dirty: Set<number>): void {
	const net = netlist.netOfPin.get(netKey(ref));
	if (net !== undefined) dirty.add(net);
}

// What a net member is currently putting onto its net.
function readDrive(member: NetMember, state: WorkingState): LogicValue {
	const { ref } = member;
	if (ref.component === 'self') {
		return state.pinValues[ref.pinId] ?? LogicValue.UNKNOWN; // value arriving from outside
	}
	const child = state.children[ref.component];
	return member.kind === 'inout'
		? (child.driveValues?.[ref.pinId] ?? LogicValue.HIGH_Z)
		: (child.pinValues[ref.pinId] ?? LogicValue.UNKNOWN);
}

// The composite's own boundary values that flow OUT to its parent:
// output pins (pinValues) and inout pins (driveValues).
function boundaryOutputs(def: CompositeDefinition, state: WorkingState): Map<string, LogicValue> {
	const out = new Map<string, LogicValue>();
	for (const pin of def.outputs) out.set(pin.id, state.pinValues[pin.id]);
	for (const pin of inoutPins(def)) out.set(pin.id, state.driveValues[pin.id]);
	return out;
}

// The reusable propagation core. Re-resolves every dirty net, delivers the
// result to each sink whose view of it changed, and keeps going until nothing
// is dirty. Returns which of the composite's own boundary outputs ended up
// different from when it started. Both normal evaluation and targeted deep
// updates (updateAtPath) funnel through here — they differ only in what
// seeds the dirty set.
function drainNets(
	lib: DefinitionLibrary,
	def: CompositeDefinition,
	state: WorkingState,
	dirty: ReadonlySet<number>,
): PinChange[] {
	const netlist = getNetlist(lib, def);
	const before = boundaryOutputs(def, state);

	const queue = [...dirty];
	const queued = new Set(queue);
	const enqueue = (net: number | undefined) => {
		if (net === undefined || queued.has(net)) return;
		queued.add(net);
		queue.push(net);
	};

	let steps = 0;
	while (queue.length > 0) {
		if (++steps > MAX_PROPAGATION_STEPS) {
			throw new Error(`Signal never settled in "${def.id}" — check for an unstable feedback loop`);
		}

		const netIndex = queue.shift()!;
		queued.delete(netIndex);
		const members = netlist.nets[netIndex].members;

		const driven = members.map((m) => (m.drives ? readDrive(m, state) : LogicValue.HIGH_Z));
		const full = resolveDrivers(driven);
		state.netValues[netIndex] = full;

		members.forEach((member, i) => {
			if (!member.sinks) return;
			// A pin that both drives and sinks (inout) sees everyone but itself.
			const value = member.drives ? resolveDrivers(driven, i) : full;
			const { ref } = member;

			if (ref.component === 'self') {
				// self output: exported through pinValues. self inout: exported through driveValues.
				const store = member.kind === 'inout' ? state.driveValues : state.pinValues;
				if (store[ref.pinId] !== value) store[ref.pinId] = value;
				return;
			}

			const child = state.children[ref.component];
			if (child.pinValues[ref.pinId] === value) return; // this sink already knows

			const result = evaluateInstance(lib, child, [{ ref, value }]);
			state.children[ref.component] = result.instance;
			for (const outChange of result.outputChanges) {
				enqueue(
					netlist.netOfPin.get(netKey({ component: ref.component, pinId: outChange.ref.pinId })),
				);
			}
		});
	}

	const changes: PinChange[] = [];
	for (const [pinId, value] of boundaryOutputs(def, state)) {
		if (before.get(pinId) !== value) {
			changes.push({ ref: { component: 'self', pinId }, value });
		}
	}
	return changes;
}

function evaluateCompositeInstance(
	lib: DefinitionLibrary,
	def: CompositeDefinition,
	instance: ComponentInstance,
	inputChanges: readonly PinChange[],
): EvalResult {
	const state = workingCopy(instance);
	const netlist = getNetlist(lib, def);

	const dirty = new Set<number>();
	for (const change of inputChanges) {
		state.pinValues[change.ref.pinId] = change.value;
		markDirty(netlist, { component: 'self', pinId: change.ref.pinId }, dirty);
	}

	const outputChanges = drainNets(lib, def, state, dirty);
	return { instance: { ...instance, ...state }, outputChanges };
}

export function evaluateTick(
	lib: DefinitionLibrary,
	rootInstance: ComponentInstance,
	externalChanges: readonly PinChange[],
): ComponentInstance {
	return evaluateInstance(lib, rootInstance, externalChanges).instance;
}

export function instantiate(
	lib: DefinitionLibrary,
	definitionId: string,
	instanceId: string,
): ComponentInstance {
	return settle(lib, buildRawInstance(lib, definitionId, instanceId));
}

function buildRawInstance(
	lib: DefinitionLibrary,
	definitionId: string,
	instanceId: string,
): ComponentInstance {
	const def = getDefinition(lib, definitionId);

	const pinValues: Record<string, LogicValue> = {};
	const driveValues: Record<string, LogicValue> = {};
	for (const pin of [...def.inputs, ...def.outputs]) pinValues[pin.id] = LogicValue.UNKNOWN;
	// Nobody is driving an inout yet: released, not uninitialised.
	for (const pin of inoutPins(def)) {
		pinValues[pin.id] = LogicValue.HIGH_Z;
		driveValues[pin.id] = LogicValue.HIGH_Z;
	}

	if (def.kind === 'primitive') {
		const primitiveState = def.initialState();
		const defaultInputs = [
			...def.inputs.map(() => LogicValue.UNKNOWN),
			...inoutPins(def).map(() => LogicValue.HIGH_Z),
		];
		const { outputs, nextState } = def.evaluate(defaultInputs, primitiveState);
		def.outputs.forEach((pin, i) => {
			pinValues[pin.id] = outputs?.[i] ?? LogicValue.LOW;
		});
		inoutPins(def).forEach((pin, j) => {
			driveValues[pin.id] = outputs?.[def.outputs.length + j] ?? LogicValue.HIGH_Z;
		});
		return { instanceId, definitionId, pinValues, driveValues, primitiveState: nextState };
	}

	const children: Record<string, ComponentInstance> = {};
	for (const child of def.children) {
		children[child.instanceId] = buildRawInstance(lib, child.definitionId, child.instanceId);
	}
	return { instanceId, definitionId, pinValues, driveValues, children, netValues: [] };
}

function settle(lib: DefinitionLibrary, instance: ComponentInstance): ComponentInstance {
	const def = getDefinition(lib, instance.definitionId);
	if (def.kind !== 'composite') return instance;

	const state = workingCopy(instance);
	let anyChildChanged = false;
	for (const child of def.children) {
		const original = instance.children![child.instanceId];
		const settledChild = settle(lib, original);
		state.children[child.instanceId] = settledChild;
		if (settledChild !== original) anyChildChanged = true;
	}

	// Any net with something already driving it needs resolving once.
	const netlist = getNetlist(lib, def);
	const dirty = new Set<number>();
	netlist.nets.forEach((net, i) => {
		if (net.members.some((m) => m.drives && readDrive(m, state) !== LogicValue.UNKNOWN)) {
			dirty.add(i);
		}
	});

	if (dirty.size === 0 && !anyChildChanged) {
		return instance; // nothing anywhere in this subtree needs settling
	}

	drainNets(lib, def, state, dirty);
	return { ...instance, ...state };
}

// --- Targeted deep updates ---------------------------------------------
//
// evaluateTick can only drive the ROOT instance's own boundary pins. A
// component like a clock can be buried several composites deep and needs to
// be pulsed directly. evaluateAtPath injects a change at any depth, then
// re-runs propagation through every ancestor on the way back up, exactly as
// if it had arrived by a normal wire.

export function evaluateAtPath(
	lib: DefinitionLibrary,
	rootInstance: ComponentInstance,
	path: readonly string[],
	changes: readonly PinChange[],
): ComponentInstance {
	if (path.length === 0) {
		return evaluateInstance(lib, rootInstance, changes).instance;
	}
	return updateAtPath(lib, rootInstance, path, changes);
}

function updateAtPath(
	lib: DefinitionLibrary,
	instance: ComponentInstance,
	path: readonly string[],
	changes: readonly PinChange[],
): ComponentInstance {
	const def = getDefinition(lib, instance.definitionId);
	if (def.kind !== 'composite') {
		throw new Error(
			`Cannot descend into "${instance.definitionId}" — it's a primitive, path should have ended here`,
		);
	}

	const [headId, ...rest] = path;
	const childInstance = instance.children![headId];
	const childDef = getDefinition(lib, childInstance.definitionId);

	let updatedChild: ComponentInstance;
	let childOutputChanges: PinChange[];

	if (rest.length === 0) {
		const result = evaluateInstance(lib, childInstance, changes);
		updatedChild = result.instance;
		childOutputChanges = [...result.outputChanges];
	} else {
		updatedChild = updateAtPath(lib, childInstance, rest, changes);
		// Deeper down, propagation already happened — here we only need which of
		// THIS child's boundary outputs (and inout drives) ended up different.
		childOutputChanges = [];
		for (const pin of childDef.outputs) {
			if (updatedChild.pinValues[pin.id] !== childInstance.pinValues[pin.id]) {
				childOutputChanges.push({
					ref: { component: 'self', pinId: pin.id },
					value: updatedChild.pinValues[pin.id],
				});
			}
		}
		for (const pin of inoutPins(childDef)) {
			const next = updatedChild.driveValues?.[pin.id] ?? LogicValue.HIGH_Z;
			if (next !== (childInstance.driveValues?.[pin.id] ?? LogicValue.HIGH_Z)) {
				childOutputChanges.push({ ref: { component: 'self', pinId: pin.id }, value: next });
			}
		}
	}

	if (updatedChild === childInstance && childOutputChanges.length === 0) {
		return instance; // nothing changed anywhere below — reuse as-is
	}

	const state = workingCopy(instance);
	state.children[headId] = updatedChild;

	const netlist = getNetlist(lib, def);
	const dirty = new Set<number>();
	for (const c of childOutputChanges) {
		markDirty(netlist, { component: headId, pinId: c.ref.pinId }, dirty);
	}

	drainNets(lib, def, state, dirty);
	return { ...instance, ...state };
}

// Handy for the renderer: the resolved value of the net a wire belongs to.
export function wireValue(
	lib: DefinitionLibrary,
	instance: ComponentInstance,
	wireId: string,
): LogicValue {
	const def = getDefinition(lib, instance.definitionId);
	if (def.kind !== 'composite') return LogicValue.UNKNOWN;
	const net = getNetlist(lib, def).netOfWire.get(wireId);
	return net === undefined ? LogicValue.UNKNOWN : (instance.netValues?.[net] ?? LogicValue.UNKNOWN);
}

// Re-exported so callers can enumerate every pin an instance owns.
export { allPins };
