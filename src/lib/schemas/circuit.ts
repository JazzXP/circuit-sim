import z from 'zod';

const logicValueSchema = z.number().int().min(0).max(3);
export type LogicValueS = z.infer<typeof logicValueSchema>;
export enum LogicValue {
	LOW = 0,
	HIGH = 1,
	HIGH_Z = 2, // tri-state / undriven — needed once you add shared buses
	UNKNOWN = 3 // uninitialized — useful for catching "read before written" bugs
}

export type PinDirection = 'input' | 'output';

export interface PinSpec {
	readonly id: string;
	readonly name: string;
	readonly direction: PinDirection;
	readonly width?: number;
}

export interface PrimitiveDefinition {
	readonly kind: 'primitive';
	readonly id: string;
	readonly name: string;
	readonly inputs: readonly PinSpec[];
	readonly outputs: readonly PinSpec[];
	readonly evaluate: (
		inputs: readonly LogicValue[],
		prevState: unknown
	) => { outputs: readonly LogicValue[]; nextState: unknown };
	readonly initialState: () => unknown;
}

export interface CompositeDefinition {
	readonly kind: 'composite';
	readonly id: string;
	readonly name: string;
	readonly inputs: readonly PinSpec[];
	readonly outputs: readonly PinSpec[];
	readonly children: readonly ChildSpec[];
	readonly internalWires: readonly WireSpec[];
}

export type ComponentDefinition = PrimitiveDefinition | CompositeDefinition;

export interface ChildSpec {
	readonly instanceId: string;
	readonly definitionId: string;
	readonly position?: { readonly x: number; readonly y: number };
}

export interface PinRef {
	readonly component: 'self' | string; // "self" or a ChildSpec.instanceId
	readonly pinId: string;
}

export interface WireSpec {
	readonly id: string;
	readonly from: PinRef;
	readonly to: readonly PinRef[];
}

export interface ComponentInstance {
	readonly instanceId: string;
	readonly definitionId: string;
	readonly pinValues: Readonly<Record<string, LogicValue>>;
	readonly children?: Readonly<Record<string, ComponentInstance>>;
	readonly primitiveState?: unknown;
}

export type DefinitionLibrary = Readonly<Record<string, ComponentDefinition>>;
