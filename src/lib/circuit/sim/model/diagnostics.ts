import type { DefinitionLibrary, ComponentInstance } from '$lib/schemas/circuit';
import { getDefinition } from './component';

export interface StateProblem {
	readonly path: readonly string[];
	readonly message: string;
}

// Call this AFTER a full evaluateTick/evaluateAtPath call has returned —
// i.e. on an already-settled instance, never mid-propagation — since
// checkState hooks are specifically meant to catch persistent problems,
// not the transient inconsistencies that are a normal, unavoidable part of
// how an event-driven engine settles (see bus.ts's checkState for the
// canonical example: bus contention).
export function findStateProblems(
	lib: DefinitionLibrary,
	instance: ComponentInstance,
	path: readonly string[] = [],
): StateProblem[] {
	const def = getDefinition(lib, instance.definitionId);
	const problems: StateProblem[] = [];

	if (def.kind === 'primitive') {
		if (def.checkState) {
			const inputValues = def.inputs.map((pin) => instance.pinValues[pin.id]);
			const message = def.checkState(inputValues);
			if (message) problems.push({ path, message });
		}
		return problems;
	}

	for (const child of def.children) {
		const childInstance = instance.children?.[child.instanceId];
		if (childInstance) {
			problems.push(...findStateProblems(lib, childInstance, [...path, child.instanceId]));
		}
	}
	return problems;
}
