import { createTimer } from '#circuit/components/primitives/index';
import { componentDefinitionSchema } from '$lib/schemas/circuit';
import ALU from './alu.json';
import CLOCK from './clock.json';
import CONTROL from './control.json';
import CPU from './cpu.json';
import REG_I from './instruction_register.json';
import MAR from './mar.json';
import OUTPUT from './output.json';
import PC from './program_counter.json';
import LOADER from './program_loader.json';
import RAM from './ram.json';
import REGISTER from './register.json';

export const EATER_COMPUTER = [
	ALU,
	CLOCK,
	CONTROL,
	CPU,
	REG_I,
	MAR,
	OUTPUT,
	PC,
	LOADER,
	RAM,
	REGISTER,

	createTimer({ id: 'OUTPUT_TIMER', name: 'output_timer', time: 1.5 }),
].map((c) => componentDefinitionSchema.parse(c));
