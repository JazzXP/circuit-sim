import { createTimer } from './timer';

export const DEFAULT_CLOCK_PERIOD_MS = 1000;
export const CLOCK = createTimer({ id: 'CLOCK', name: 'CLOCK', time: DEFAULT_CLOCK_PERIOD_MS });
