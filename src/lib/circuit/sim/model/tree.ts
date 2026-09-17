// Walks the whole instance tree looking for every instance of a given
// definition, returning each one's drill-path from the root. Used to find
// every CLOCK instance anywhere in a circuit — however deeply nested —

import type { ComponentInstance } from '$lib/schemas/circuit';

// without the caller needing to know the circuit's shape in advance.
export interface InstanceMatch {
	readonly path: readonly string[];
	readonly instance: ComponentInstance;
}

export function findInstancesByDefinition(
	root: ComponentInstance,
	definitionId: string,
	path: readonly string[] = [],
): InstanceMatch[] {
	const matches: InstanceMatch[] = [];
	if (root.definitionId === definitionId) {
		matches.push({ path, instance: root });
	}
	if (root.children) {
		for (const [instanceId, child] of Object.entries(root.children)) {
			matches.push(...findInstancesByDefinition(child, definitionId, [...path, instanceId]));
		}
	}
	return matches;
}

// Pure, no-propagation update of a single instance's own fields (pinValues,
// primitiveState) anywhere in the tree — for changing something about a
// component that doesn't itself represent a logic-level signal change, like
// a clock's configured period. Since this never touches wires, nothing
// downstream is re-evaluated; use evaluateAtPath in sim/controller/engine.ts
// instead when the change should actually propagate through the circuit.
export function updateInstanceStateAtPath(
	root: ComponentInstance,
	path: readonly string[],
	updater: (instance: ComponentInstance) => ComponentInstance,
): ComponentInstance {
	if (path.length === 0) {
		return updater(root);
	}
	const [headId, ...rest] = path;
	const child = root.children?.[headId];
	if (!child) throw new Error(`No instance "${headId}" at this level of the path`);

	const updatedChild = updateInstanceStateAtPath(child, rest, updater);
	if (updatedChild === child) return root;

	return { ...root, children: { ...root.children, [headId]: updatedChild } };
}
