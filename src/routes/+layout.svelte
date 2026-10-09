<script lang="ts">
	import { setCacheContext, setDefinitionLibraryContext } from '#circuit/render/cacheContext';
	import type { Layout } from '#circuit/render/types';
	import { emptyLibrary, registerDefinition } from '#circuit/sim/model/component';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import type { DefinitionLibrary } from '$lib/schemas/circuit';

	import { PRIMITIVE_DEFS } from '#circuit/components/primitives/index';
	import { COMPOSITE_DEFS } from '#circuit/components/composites/index';
	import { EATER_EEPROMS } from '../eater/eeproms';
	import { CHIPS } from '../eater/chips';
	import { EATER_COMPUTER } from '../eater';
	import { buildCustomOutput } from '$lib/customOutput';

	let { children } = $props();
	const links = [
		{ href: '/', label: 'Home' },
		{ href: '/clock', label: 'Clock' },
		{ href: '/registers', label: 'Registers' },
		{ href: '/alu', label: 'Arithmetic logic unit' },
		{ href: '/ram', label: 'Random Access Memory' },
		{ href: '/pc', label: 'Program Counter' },
		{ href: '/output', label: 'Output register' },
		{ href: '/control', label: 'Control logic' },
		{ href: '/cpu', label: 'Full CPU' },
	] as const;
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	setCacheContext(new WeakMap<DefinitionLibrary, Map<string, Layout>>());
	let library = setDefinitionLibraryContext(emptyLibrary);
	if (Object.keys(library).length === 0) {
		for (const def of [
			...PRIMITIVE_DEFS,
			...COMPOSITE_DEFS,
			...EATER_EEPROMS,
			...CHIPS,
			...EATER_COMPUTER,
			buildCustomOutput(),
		]) {
			library = setDefinitionLibraryContext(registerDefinition(library, def));
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Unica+One&display=swap" rel="stylesheet" />
</svelte:head>

<nav>
	<ul>
		{#each links as { href, label } (href)}
			<li class:active={isActive(href)}>
				{#if isActive(href)}
					<span aria-current="page">{label}</span>
				{:else}
					<a href={resolve(href)}>{label}</a>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
<main>
	{@render children()}
</main>

<style>
	:global(html, body) {
		height: 100vh;
		overflow: hidden;
		padding: 0;
		margin: 0;
		font-family: sans-serif;
		background: var(--background-colour);
		color: var(--secondary-colour);
	}
	:global(body) {
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: 16px;
		box-sizing: border-box;
	}
	:global(:root) {
		--primary-colour: oklch(0.3633 0.1039 250.5);
		--secondary-colour: oklch(from var(--primary-colour) calc(l + ((1 - l) * 0.8)) c h);
		--secondary-colour-glow: oklch(from var(--primary-colour) calc(l + ((1 - l) * 0.9)) c h);
		--tertiary-colour: oklch(from var(--primary-colour) calc(l + ((1 - l) * 0.5)) c h);
		--background-colour: oklch(from var(--primary-colour) 0.1 c h);
	}
	:global(h1, h2, h3, h4) {
		font-family: 'Unica One', sans-serif;
		font-weight: 400;
		font-style: normal;
		color: var(--secondary-colour);
		text-shadow:
			0 0 2.5px var(--tertiary-colour),
			0 0 5px var(--tertiary-colour),
			0 0 10px var(--tertiary-colour),
			0 0 20px var(--tertiary-colour);
	}

	:global(.narrow) {
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: stretch;
		height: 100%;
		margin-bottom: 0;
	}
	:global(.border) {
		border: solid 1px var(--secondary-colour);
		overflow: hidden;
		border-radius: 8px;
		padding: 16px;

		box-shadow: 0 0 20px var(--tertiary-colour);
		margin-bottom: 20px;
	}
	:global(a[href^='https://']) {
		font-weight: 600;
		font-style: normal;
		text-decoration: none;
		position: relative;
		margin-right: 1rem;
		color: var(--tertiary-colour);

		&::after {
			position: absolute;
			top: -0.3rem;
			right: -0.8rem;
			content: ' \2197';
			font-size: 0.85em;
			margin-left: 4px;
		}
		&:hover {
			text-decoration: underline;
		}
	}

	nav {
		margin: 0;
		display: flex;
	}
	ul {
		display: flex;
		padding: 0;
		flex: 1;
		list-style-type: none;
		border-bottom: 2px solid var(--primary-colour);
		margin: 0;
		align-items: stretch;
		justify-content: stretch;
		color: var(--primary-colour);
		font-size: 0.9rem;
		overflow-x: auto;
	}
	/* Creating a glowing background blur behind the element */
	li::before {
		content: '';
		position: absolute;
		inset: -2px; /* Slightly larger than the box */
		background: linear-gradient(45deg, var(--primary-colour), var(--secondary-colour));
		border-radius: 8px;
		z-index: -1;
		filter: blur(6px);
		opacity: 0.8;
	}
	li {
		position: relative;
		flex: 0 1 auto;
		z-index: 1;
		border-right: 2px solid var(--primary-colour);
		flex: 1;
		display: flex;
		justify-content: stretch;
		align-items: stretch;
		color: var(--primary-colour);
		background: var(--secondary-colour);
		transition: all 0.2s ease-in-out;
		&:hover,
		&.active {
			color: var(--secondary-colour);
			opacity: 1;
			background: var(--primary-colour);
			&::before {
				border-radius: 6px;
				filter: blur(4px);
			}
		}
		&.active {
			--glow-colour: oklch(from var(--primary-colour) 1 c calc(h+128));
			a,
			span {
				color: oklch(from var(--primary-colour) 0.9 c calc(h + 128));
				text-shadow:
					0 0 5px var(--glow-colour),
					0 0 10px var(--glow-colour),
					0 0 20px var(--glow-colour),
					0 0 40px var(--glow-colour);
			}
		}
	}
	li:last-child {
		border-right: none;
	}
	a,
	span {
		position: relative;
		display: block;
		padding: 8px;
		flex: 1;
		transition: all 0.2s ease-in-out;
		font-family: 'Unica One', sans-serif;
		font-weight: 400;
		font-style: normal;
		text-decoration: none;
		text-align: center;
		color: var(--primary-colour);
		white-space: nowrap;
		text-shadow:
			0 0 5px var(--secondary-colour),
			0 0 10px var(--secondary-colour),
			0 0 20px var(--secondary-colour),
			0 0 40px var(--secondary-colour);
		&:hover {
			text-shadow:
				0 0 5px var(--secondary-colour-glow),
				0 0 10px var(--secondary-colour-glow),
				0 0 20px var(--secondary-colour-glow),
				0 0 40px var(--secondary-colour-glow);
		}
	}
	main {
		padding-inline: 16px;
	}
</style>
