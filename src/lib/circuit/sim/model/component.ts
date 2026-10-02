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

type PinDef = ComponentDefinition['inputs'][number];

export const emptyLibrary: DefinitionLibrary = {};

export function getDefinition(lib: DefinitionLibrary, id: string): ComponentDefinition {
	const def = lib[id];
	if (!def) throw new Error(`Unknown definition: ${id}`);
	return def;
}
export function getSizeForDefinition(
	lib: DefinitionLibrary,
	id: string,
): { minCanvasWidth?: number; minCanvasHeight?: number } {
	const def = lib[id];
	if (!def) throw new Error(`Unknown definition: ${id}`);
	return {
		minCanvasWidth: def.minCanvasWidth,
		minCanvasHeight: def.minCanvasHeight,
	};
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

export function inoutPins(def: ComponentDefinition): readonly PinDef[] {
	return def.inouts ?? [];
}
export const evalInputPins = (def: ComponentDefinition) => [...def.inputs, ...inoutPins(def)];
export const evalOutputPins = (def: ComponentDefinition) => [...def.outputs, ...inoutPins(def)];
export const allPins = (def: ComponentDefinition) => [
	...def.inputs,
	...def.outputs,
	...inoutPins(def),
];
// Net resolution. Undriven (HIGH_Z) drivers are ignored; agreeing drivers win;
// any disagreement or UNKNOWN driver gives UNKNOWN. `skip` omits one driver,
// which is how an inout pin gets "everyone but me".
export function resolveDrivers(values: readonly LogicValue[], skip = -1): LogicValue {
	let result = LogicValue.HIGH_Z;
	for (let i = 0; i < values.length; i++) {
		if (i === skip) continue;
		const v = values[i];
		if (v === LogicValue.HIGH_Z) continue;
		if (v === LogicValue.UNKNOWN) return LogicValue.UNKNOWN;
		if (result === LogicValue.HIGH_Z) result = v;
		else if (result !== v) return LogicValue.UNKNOWN; // contention
	}
	return result;
}

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
