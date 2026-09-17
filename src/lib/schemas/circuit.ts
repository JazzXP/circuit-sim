import z from 'zod';

const logicValueSchema = z.number().int().min(0).max(3);
const pinDirectionSchema = z.enum(['input', 'output']);
const pinSpecSchema = z.object({
	id: z.string(),
	name: z.string(),
	direction: pinDirectionSchema,
	width: z.number().optional(),
	defaultValue: logicValueSchema.optional(),
});
const pinRefSchema = z.object({
	component: z.union([z.literal('self'), z.string()]).readonly(),
	pinId: z.string().readonly(),
});
const wireSpecSchema = z.object({
	from: pinRefSchema,
	to: pinRefSchema.array().readonly(),
});
export type WireSpec = z.infer<typeof wireSpecSchema>;

const primitiveDefinitionSchema = z.object({
	kind: z.literal('primitive'),
	id: z.string(),
	name: z.string(),
	inputs: pinSpecSchema.array().readonly(),
	outputs: pinSpecSchema.array().readonly(),

	evaluate: z
		.function({
			input: [logicValueSchema.array(), z.unknown()],
			output: z.object({
				outputs: logicValueSchema.array().optional().readonly(),
				nextState: z.unknown().optional().readonly(),
			}),
		})
		.readonly(),
	initialState: z.function({ output: z.unknown().readonly().optional() }).readonly(),
});

const childSpecSchema = z.object({
	instanceId: z.string().readonly(),
	definitionId: z.string().readonly(),
	position: z
		.object({
			x: z.number().readonly(),
			y: z.number().readonly(),
		})
		.readonly()
		.optional(),
	column: z.number().readonly().optional(),
});

const compositeDefinitionSchema = z.object({
	kind: z.literal('composite'),
	id: z.string(),
	name: z.string(),
	inputs: pinSpecSchema.array().readonly(),
	outputs: pinSpecSchema.array().readonly(),
	children: childSpecSchema.array().readonly(),
	internalWires: wireSpecSchema.array().readonly(),
});

export const componentDefinitionSchema = z.discriminatedUnion('kind', [
	primitiveDefinitionSchema.readonly(),
	compositeDefinitionSchema.readonly(),
]);
export type ComponentInstance = {
	readonly instanceId: string;
	readonly definitionId: string;
	readonly pinValues: Readonly<Record<string, number>>;
	readonly children?: Readonly<Record<string, ComponentInstance>>;
	readonly primitiveState?: Readonly<unknown>;
};

export const componentInstanceSchema: z.ZodType<ComponentInstance> = z.object({
	instanceId: z.string().readonly(),
	definitionId: z.string().readonly(),
	pinValues: z.record(z.string(), logicValueSchema).readonly(),
	get children() {
		return z.record(z.string(), componentInstanceSchema).optional().readonly();
	},
	primitiveState: z.unknown().optional().readonly(),
});

export const definitionLibrarySchema = z.record(z.string(), componentDefinitionSchema).readonly();

export type LogicValue = z.infer<typeof logicValueSchema>;
export type PinDirection = z.infer<typeof pinDirectionSchema>;
export type PinSpec = z.infer<typeof pinSpecSchema>;

export type ChildSpec = z.infer<typeof childSpecSchema>;

export type PrimitiveDefinition = z.infer<typeof primitiveDefinitionSchema>;
export type CompositeDefinition = z.infer<typeof compositeDefinitionSchema>;

export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;

export type PinRef = z.infer<typeof pinRefSchema>;

export type DefinitionLibrary = z.infer<typeof definitionLibrarySchema>;
