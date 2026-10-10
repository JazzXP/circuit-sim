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
				instanceId: 'customDisp1',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 8,
				groupName: 'output',
			},
			{
				instanceId: 'customDisp2',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 7,
				groupName: 'output',
			},
			{
				instanceId: 'customDisp3',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 6,
				groupName: 'output',
			},
			{
				instanceId: 'customDisp4',
				definitionId: 'SEVEN_SEGMENT_DISPLAY',
				column: 5,
				groupName: 'output',
			},
		],
		internalWires: [...base.internalWires],
	};
	for (const wire of CUSTOM_OUTPUT.internalWires) {
		if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D0')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'a' },
				{ component: 'customDisp2', pinId: 'a' },
				{ component: 'customDisp3', pinId: 'a' },
				{ component: 'customDisp4', pinId: 'a' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D1')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'b' },
				{ component: 'customDisp2', pinId: 'b' },
				{ component: 'customDisp3', pinId: 'b' },
				{ component: 'customDisp4', pinId: 'b' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D2')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'c' },
				{ component: 'customDisp2', pinId: 'c' },
				{ component: 'customDisp3', pinId: 'c' },
				{ component: 'customDisp4', pinId: 'c' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D3')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'd' },
				{ component: 'customDisp2', pinId: 'd' },
				{ component: 'customDisp3', pinId: 'd' },
				{ component: 'customDisp4', pinId: 'd' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D4')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'e' },
				{ component: 'customDisp2', pinId: 'e' },
				{ component: 'customDisp3', pinId: 'e' },
				{ component: 'customDisp4', pinId: 'e' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D5')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'f' },
				{ component: 'customDisp2', pinId: 'f' },
				{ component: 'customDisp3', pinId: 'f' },
				{ component: 'customDisp4', pinId: 'f' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D6')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'g' },
				{ component: 'customDisp2', pinId: 'g' },
				{ component: 'customDisp3', pinId: 'g' },
				{ component: 'customDisp4', pinId: 'g' },
			];
		} else if (wire.from.component === 'output_eeprom' && wire.from.pinId.startsWith('D7')) {
			wire.to = [
				{ component: 'customDisp1', pinId: 'dp' },
				{ component: 'customDisp2', pinId: 'dp' },
				{ component: 'customDisp3', pinId: 'dp' },
				{ component: 'customDisp4', pinId: 'dp' },
			];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y0_n')) {
			wire.to = [{ component: 'customDisp1', pinId: 'en' }];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y1_n')) {
			wire.to = [{ component: 'customDisp2', pinId: 'en' }];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y2_n')) {
			wire.to = [{ component: 'customDisp3', pinId: 'en' }];
		} else if (wire.from.component === '74ls139' && wire.from.pinId.startsWith('1Y3_n')) {
			wire.to = [{ component: 'customDisp4', pinId: 'en' }];
		}
	}
	return CUSTOM_OUTPUT;
};
