// Core model: pure data types + pure functions, no classes, no mutation.
// Everything is a ComponentDefinition, either primitive (native eval fn) or
// composite (built from instances of other definitions). Reuse and
// drill-down both fall out of this definition/instance split.

import type { ComponentDefinition, DefinitionLibrary } from '$lib/schemas/circuit';

export enum LogicValue {
	LOW = 0,
	HIGH = 1,
	HIGH_Z = 2, // tri-state / undriven — needed once you add shared buses
	UNKNOWN = 3, // uninitialized — useful for catching "read before written" bugs
}
export const emptyLibrary: DefinitionLibrary = {};

export function getDefinition(lib: DefinitionLibrary, id: string): ComponentDefinition {
	const def = lib[id];
	if (!def) throw new Error(`Unknown definition: ${id}`);
	return def;
}

export function registerDefinition(
	lib: DefinitionLibrary,
	def: ComponentDefinition,
): DefinitionLibrary {
	if (wouldCreateCycle(lib, def)) {
		throw new Error(`Registering "${def.id}" would create a circular dependency`);
	}
	return { ...lib, [def.id]: def };
}

function wouldCreateCycle(
	lib: DefinitionLibrary,
	def: ComponentDefinition,
	seen: ReadonlySet<string> = new Set(),
): boolean {
	if (def.kind === 'primitive') return false;
	for (const child of def.children) {
		if (child.definitionId === def.id) return true;
		if (seen.has(child.definitionId)) continue;
		const childDef = lib[child.definitionId];
		if (childDef && wouldCreateCycle(lib, childDef, new Set([...seen, child.definitionId]))) {
			return true;
		}
	}
	return false;
}

// export function instantiate(
// 	lib: DefinitionLibrary,
// 	definitionId: string,
// 	instanceId: string,
// ): ComponentInstance {
// 	const def = getDefinition(lib, definitionId);
//
// 	const initialPinValues: Record<string, LogicValue> = {};
// 	for (const pin of [...def.inputs, ...def.outputs]) {
// 		initialPinValues[pin.id] = pin.defaultValue ?? LogicValue.UNKNOWN;
// 	}
//
// 	if (def.kind === 'primitive') {
// 		const primitiveState = def.initialState();
// 		if (def.inputs.length === 0) {
// 			// A source with no inputs (e.g. a tied-off constant) has nothing to
// 			// ever deliver it an event, so it would sit at UNKNOWN forever under
// 			// the normal event-driven model. Seed it immediately instead — this
// 			// matches real hardware, where a tied-off rail is just always at its
// 			// voltage from power-on, no "first event" required.
// 			const { outputs, nextState } = def.evaluate([], primitiveState);
// 			def.outputs.forEach((pin, i) => {
// 				initialPinValues[pin.id] = outputs?.[i] ?? 0;
// 			});
// 			return { instanceId, definitionId, pinValues: initialPinValues, primitiveState: nextState };
// 		}
//
// 		return {
// 			instanceId,
// 			definitionId,
// 			pinValues: initialPinValues,
// 			primitiveState: def.initialState(),
// 		};
// 	}
//
// 	const children: Record<string, ComponentInstance> = {};
// 	for (const child of def.children) {
// 		children[child.instanceId] = instantiate(lib, child.definitionId, child.instanceId);
// 	}
//
// 	return { instanceId, definitionId, pinValues: initialPinValues, children };
// }

// Drill-down navigation as a plain readonly stack.
export interface DrillPathEntry {
	readonly instanceId: string;
	readonly definitionId: string;
}
export type DrillPath = readonly DrillPathEntry[];

export function pushDrillPath(path: DrillPath, entry: DrillPathEntry): DrillPath {
	return [...path, entry];
}
export function popDrillPath(path: DrillPath): DrillPath {
	return path.slice(0, -1);
}
