// Event-driven evaluation engine. Pure functions throughout: every
// evaluate* call takes an instance tree and a set of incoming changes, and
// returns a brand new tree plus whatever changed on its own boundary.

import type {
	ComponentInstance,
	CompositeDefinition,
	DefinitionLibrary,
	PinRef,
	PrimitiveDefinition,
	WireSpec,
} from '$lib/schemas/circuit';
import { LogicValue, getDefinition } from '../model/component';
import { v4 as uuid } from 'uuid';

export interface PinChange {
	readonly ref: PinRef; // "self" = this instance's own boundary pin
	readonly value: LogicValue;
}

function pinKey(ref: PinRef): string {
	return `${ref.component}:${ref.pinId}`;
}

function wiresBySource(def: CompositeDefinition): ReadonlyMap<string, readonly WireSpec[]> {
	const map = new Map<string, WireSpec[]>();
	for (const wire of def.internalWires) {
		wire.id = wire.id ?? uuid();
		const key = pinKey(wire.from);
		const list = map.get(key);
		if (list) list.push(wire);
		else map.set(key, [wire]);
	}
	return map;
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
	for (const change of inputChanges) pinValues[change.ref.pinId] = change.value;

	const inputArray = def.inputs.map((pin) => pinValues[pin.id]);
	const { outputs, nextState } = def.evaluate(inputArray, instance.primitiveState);

	const outputChanges: PinChange[] = [];
	def.outputs.forEach((pin, i) => {
		if (pinValues[pin.id] !== outputs?.[i]) {
			pinValues[pin.id] = outputs?.[i] ?? 0;
			outputChanges.push({ ref: { component: 'self', pinId: pin.id }, value: outputs?.[i] ?? 0 });
		}
	});

	const nextInstance: ComponentInstance = { ...instance, pinValues, primitiveState: nextState };
	return { instance: nextInstance, outputChanges };
}

const MAX_PROPAGATION_STEPS = 10_000;

// The reusable propagation core: given a composite's wiring, a seeded queue
// of events, and mutable working copies of pinValues/children, drains the
// queue and reports which of the composite's own boundary outputs changed.
// Both a normal top-down evaluation (evaluateCompositeInstance) and a
// targeted deep update (updateAtPath, below) funnel through this — the only
// difference between them is what seeds the queue.
function drainPropagationQueue(
	lib: DefinitionLibrary,
	def: CompositeDefinition,
	pinValues: Record<string, LogicValue>,
	children: Record<string, ComponentInstance>,
	initialQueue: PinChange[],
): { boundaryOutputChanges: PinChange[] } {
	const sourceIndex = wiresBySource(def);
	const boundaryOutputChanges: PinChange[] = [];
	const queue = initialQueue;

	let steps = 0;
	while (queue.length > 0) {
		if (++steps > MAX_PROPAGATION_STEPS) {
			throw new Error(`Signal never settled in "${def.id}" — check for an unstable feedback loop`);
		}

		const change = queue.shift()!;
		const wires = sourceIndex.get(pinKey(change.ref)) ?? [];

		for (const wire of wires) {
			for (const dest of wire.to) {
				if (dest.component === 'self') {
					if (pinValues[dest.pinId] !== change.value) {
						pinValues[dest.pinId] = change.value;
						boundaryOutputChanges.push({ ref: dest, value: change.value });
					}
					continue;
				}

				const childInstance = children[dest.component];
				const result = evaluateInstance(lib, childInstance, [{ ref: dest, value: change.value }]);

				if (result.instance !== childInstance) {
					children[dest.component] = result.instance;
				}
				for (const outChange of result.outputChanges) {
					queue.push({
						ref: { component: dest.component, pinId: outChange.ref.pinId },
						value: outChange.value,
					});
				}
			}
		}
	}

	return { boundaryOutputChanges };
}

function evaluateCompositeInstance(
	lib: DefinitionLibrary,
	def: CompositeDefinition,
	instance: ComponentInstance,
	inputChanges: readonly PinChange[],
): EvalResult {
	const pinValues = { ...instance.pinValues };
	const children: Record<string, Readonly<ComponentInstance>> = { ...(instance.children ?? {}) };

	const initialQueue: PinChange[] = [];
	for (const change of inputChanges) {
		pinValues[change.ref.pinId] = change.value;
		initialQueue.push({ ref: { component: 'self', pinId: change.ref.pinId }, value: change.value });
	}

	const { boundaryOutputChanges } = drainPropagationQueue(
		lib,
		def,
		pinValues,
		children,
		initialQueue,
	);

	const nextInstance: ComponentInstance = { ...instance, pinValues, children };
	return { instance: nextInstance, outputChanges: boundaryOutputChanges };
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

	const initialPinValues: Record<string, LogicValue> = {};
	for (const pin of [...def.inputs, ...def.outputs]) {
		initialPinValues[pin.id] = LogicValue.UNKNOWN;
	}

	if (def.kind === 'primitive') {
		const primitiveState = def.initialState();
		const defaultInputs = def.inputs.map(() => LogicValue.UNKNOWN);
		const { outputs, nextState } = def.evaluate(defaultInputs, primitiveState);
		def.outputs.forEach((pin, i) => {
			initialPinValues[pin.id] = outputs?.[i] ?? 0;
		});
		return { instanceId, definitionId, pinValues: initialPinValues, primitiveState: nextState };
	}

	const children: Record<string, ComponentInstance> = {};
	for (const child of def.children) {
		children[child.instanceId] = buildRawInstance(lib, child.definitionId, child.instanceId);
	}

	return { instanceId, definitionId, pinValues: initialPinValues, children };
}

function settle(lib: DefinitionLibrary, instance: ComponentInstance): ComponentInstance {
	const def = getDefinition(lib, instance.definitionId);
	if (def.kind !== 'composite') return instance;

	const children: Record<string, ComponentInstance> = {};
	let anyChildChanged = false;
	for (const child of def.children) {
		const original = instance.children![child.instanceId];
		const settledChild = settle(lib, original);
		children[child.instanceId] = settledChild;
		if (settledChild !== original) anyChildChanged = true;
	}

	const pinValues = { ...instance.pinValues };
	const initialQueue: PinChange[] = [];
	for (const child of def.children) {
		const childDef = getDefinition(lib, child.definitionId);
		for (const pin of childDef.outputs) {
			const value = children[child.instanceId].pinValues[pin.id];
			if (value !== LogicValue.UNKNOWN) {
				initialQueue.push({ ref: { component: child.instanceId, pinId: pin.id }, value });
			}
		}
	}

	if (initialQueue.length === 0 && !anyChildChanged) {
		return instance; // nothing anywhere in this subtree needs settling
	}

	drainPropagationQueue(lib, def, pinValues, children, initialQueue);

	return { ...instance, pinValues, children };
}

// --- Targeted deep updates ---------------------------------------------
//
// evaluateTick can only drive the ROOT instance's own boundary pins — fine
// for switches, since those always live at the top. A component like a
// clock is different: it can be buried several composites deep, and needs
// to be pulsed directly rather than through a chain of wires that don't
// logically exist. evaluateAtPath lets a change be injected at any depth,
// then correctly re-runs propagation through every ancestor on the way
// back up to the root, exactly as if the change had arrived by normal wire
// — it just skips needing an actual wire to get there.

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
		// Deeper down, propagation already happened — here we only need to know
		// which of THIS child's own boundary outputs actually ended up
		// different, so this level's wires know what to propagate further.
		childOutputChanges = [];
		for (const pin of childDef.outputs) {
			if (updatedChild.pinValues[pin.id] !== childInstance.pinValues[pin.id]) {
				childOutputChanges.push({
					ref: { component: 'self', pinId: pin.id },
					value: updatedChild.pinValues[pin.id],
				});
			}
		}
	}

	if (updatedChild === childInstance && childOutputChanges.length === 0) {
		return instance; // nothing changed anywhere below — reuse as-is
	}

	const pinValues = { ...instance.pinValues };
	const children = { ...instance.children, [headId]: updatedChild };
	const initialQueue: PinChange[] = childOutputChanges.map((c) => ({
		ref: { component: headId, pinId: c.ref.pinId },
		value: c.value,
	}));

	drainPropagationQueue(lib, def, pinValues, children, initialQueue);

	return { ...instance, pinValues, children };
}
