import type { DefinitionLibrary } from '$lib/schemas/circuit';
import { createContext } from 'svelte';
import type { Layout } from './types';
export type LibraryCache = WeakMap<DefinitionLibrary, Map<string, Layout>>;

export const [getCacheContext, setCacheContext] = createContext<LibraryCache>();
export const [getDefinitionLibraryContext, setDefinitionLibraryContext] =
	createContext<DefinitionLibrary>();
