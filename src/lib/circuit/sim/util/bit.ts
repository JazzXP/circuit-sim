import { LogicValue } from '#sim/model/component';

// Treats anything that isn't a confirmed HIGH as a 0 for the purposes of
// boolean gate math. This is a simplification (real simulators track X/Z
// propagation more rigorously) but is plenty for a teaching/hobby simulator.
export const bit = (v: LogicValue): 0 | 1 => (v === LogicValue.HIGH ? 1 : 0);

export const fromBit = (b: 0 | 1): LogicValue => (b ? LogicValue.HIGH : LogicValue.LOW);

export const displayValue = (v: LogicValue): string =>
	v === LogicValue.HIGH ? 'H' : v === LogicValue.LOW ? 'L' : v === LogicValue.HIGH_Z ? 'Z' : '?';
