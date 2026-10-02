import { componentDefinitionSchema } from '$lib/schemas/circuit';
import CHIP_74189 from './74189.json';
import CHIP_74LS139 from './74ls139.json';
import CHIP_74LS157 from './74ls157.json';
import CHIP_74LS161 from './74ls161.json';
import CHIP_74LS173 from './74ls173.json';
import CHIP_74LS273 from './74ls273.json';
import CHIP_74LS283 from './74ls283.json';
import CHIP_74LS76 from './74ls76.json';

export const CHIPS = [
	CHIP_74189,
	CHIP_74LS139,
	CHIP_74LS157,
	CHIP_74LS161,
	CHIP_74LS173,
	CHIP_74LS273,
	CHIP_74LS283,
	CHIP_74LS283,
	CHIP_74LS76,
].map((c) => componentDefinitionSchema.parse(c));
