import z from 'zod';

const logicValueSchema = z.number().int().min(0).max(3);
const pinSpecSchema = z.object({
	id: z.string(),
	name: z.string(),
	width: z.number().optional(),
	defaultValue: logicValueSchema.optional(),
});
const pinRefSchema = z.object({
	component: z.union([z.literal('self'), z.string()]).readonly(),
	pinId: z.string().readonly(),
});
const wireSpecSchema = z.object({
	id: z.string().optional(),
	from: pinRefSchema,
	to: pinRefSchema.array().readonly(),
	colour: z.string().optional().readonly(),
	groupName: z.string().optional().readonly(),
});
export type WireSpec = z.infer<typeof wireSpecSchema>;

const primitiveDefinitionSchema = z.object({
	kind: z.literal('primitive'),
	id: z.string(),
	name: z.string(),
	minCanvasWidth: z.number().optional(),
	minCanvasHeight: z.number().optional(),
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
	checkState: z
		.function({ input: [logicValueSchema.array()], output: z.string().or(z.null()) })
		.readonly()
		.optional(),
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
	name: z.string().optional(),
	groupName: z.string().readonly().optional(),
});

const compositeDefinitionSchema = z.object({
	kind: z.literal('composite'),
	id: z.string(),
	name: z.string(),
	minCanvasWidth: z.number().optional(),
	minCanvasHeight: z.number().optional(),
	inputs: pinSpecSchema.array().readonly(),
	outputs: pinSpecSchema.array().readonly(),
	children: childSpecSchema.array().readonly(),
	internalWires: wireSpecSchema.array().readonly(),
});

export const busConfigSchema = z.object({
	id: z.string().readonly(),
	name: z.string().readonly(),
	driverCount: z.number().readonly(),
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
	readonly groupName?: string;
};

export const componentInstanceSchema: z.ZodType<ComponentInstance> = z.object({
	instanceId: z.string().readonly(),
	definitionId: z.string().readonly(),
	pinValues: z.record(z.string(), logicValueSchema).readonly(),
	get children() {
		return z.record(z.string(), componentInstanceSchema).optional().readonly();
	},
	primitiveState: z.unknown().optional().readonly(),
	groupName: z.string().optional(),
});

export const definitionLibrarySchema = z.record(z.string(), componentDefinitionSchema).readonly();

export type LogicValue = z.infer<typeof logicValueSchema>;
export type PinSpec = z.infer<typeof pinSpecSchema>;

export type ChildSpec = z.infer<typeof childSpecSchema>;

export type PrimitiveDefinition = z.infer<typeof primitiveDefinitionSchema>;
export type CompositeDefinition = z.infer<typeof compositeDefinitionSchema>;

export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;

export type PinRef = z.infer<typeof pinRefSchema>;

export type DefinitionLibrary = z.infer<typeof definitionLibrarySchema>;

export type BusConfig = z.infer<typeof busConfigSchema>;
