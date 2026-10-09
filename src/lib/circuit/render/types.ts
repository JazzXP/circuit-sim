import type { RoutedWire } from './routing';

export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface ChildLayout {
	readonly instanceId: string;
	readonly definitionId: string;
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
	readonly inputPos: Readonly<Record<string, Point>>;
	readonly outputPos: Readonly<Record<string, Point>>;
	readonly inputStubPos: Readonly<Record<string, Point>>;
	readonly outputStubPos: Readonly<Record<string, Point>>;

	readonly inoutPos: Readonly<Record<string, Point>>;
	readonly inoutStubPos: Readonly<Record<string, Point>>;
}

export interface Layout {
	readonly selfInputPos: Readonly<Record<string, Point>>;
	readonly selfOutputPos: Readonly<Record<string, Point>>;
	readonly children: Readonly<Record<string, ChildLayout>>;
	readonly routes: readonly RoutedWire[];

	readonly selfInoutPos: Readonly<Record<string, Point>>;
}
