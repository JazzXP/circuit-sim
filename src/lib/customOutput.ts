import { EATER_COMPUTER } from '../eater';
import type { CompositeDefinition } from './schemas/circuit';

export const buildCustomOutput = () => {
	const base = structuredClone({
		...EATER_COMPUTER.filter((c) => c.id === 'OUTPUT_MODULE')[0],
	}) as CompositeDefinition;

	const CUSTOM_OUTPUT: CompositeDefinition = {
		...base,
		id: 'CUSTOM_OUTPUT',
		name: 'Output',
		minCanvasWidth: 2000,
		minCanvasHeight: 870,
		outputs: [],
		children: [
			...base.children,
			{
				instanceId: 'disp1',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 8,
				groupName: 'output',
			},
			{
				instanceId: 'disp2',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 7,
				groupName: 'output',
			},
			{
				instanceId: 'disp3',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 6,
				groupName: 'output',
			},
			{
				instanceId: 'disp4',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 5,
				groupName: 'output',
			},
		],
	};
	for (const wire of CUSTOM_OUTPUT.internalWires) {
		if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D0')) {
			wire.to = [
				{ component: 'disp1', pinId: 'a' },
				{ component: 'disp2', pinId: 'a' },
				{ component: 'disp3', pinId: 'a' },
				{ component: 'disp4', pinId: 'a' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D1')) {
			wire.to = [
				{ component: 'disp1', pinId: 'b' },
				{ component: 'disp2', pinId: 'b' },
				{ component: 'disp3', pinId: 'b' },
				{ component: 'disp4', pinId: 'b' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D2')) {
			wire.to = [
				{ component: 'disp1', pinId: 'c' },
				{ component: 'disp2', pinId: 'c' },
				{ component: 'disp3', pinId: 'c' },
				{ component: 'disp4', pinId: 'c' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D3')) {
			wire.to = [
				{ component: 'disp1', pinId: 'd' },
				{ component: 'disp2', pinId: 'd' },
				{ component: 'disp3', pinId: 'd' },
				{ component: 'disp4', pinId: 'd' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D4')) {
			wire.to = [
				{ component: 'disp1', pinId: 'e' },
				{ component: 'disp2', pinId: 'e' },
				{ component: 'disp3', pinId: 'e' },
				{ component: 'disp4', pinId: 'e' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D5')) {
			wire.to = [
				{ component: 'disp1', pinId: 'f' },
				{ component: 'disp2', pinId: 'f' },
				{ component: 'disp3', pinId: 'f' },
				{ component: 'disp4', pinId: 'f' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D6')) {
			wire.to = [
				{ component: 'disp1', pinId: 'g' },
				{ component: 'disp2', pinId: 'g' },
				{ component: 'disp3', pinId: 'g' },
				{ component: 'disp4', pinId: 'g' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D7')) {
			wire.to = [
				{ component: 'disp1', pinId: 'dp' },
				{ component: 'disp2', pinId: 'dp' },
				{ component: 'disp3', pinId: 'dp' },
				{ component: 'disp4', pinId: 'dp' },
			];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y0_n')) {
			wire.to = [{ component: 'disp1', pinId: 'en' }];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y1_n')) {
			wire.to = [{ component: 'disp2', pinId: 'en' }];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y2_n')) {
			wire.to = [{ component: 'disp3', pinId: 'en' }];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y3_n')) {
			wire.to = [{ component: 'disp4', pinId: 'en' }];
		}
	}
	return CUSTOM_OUTPUT;
};
