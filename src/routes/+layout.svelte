<script lang="ts">
	import '../main.css';
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

<div class="max-lg:collapse bg-base-200 shadow-sm w-full rounded-md">
	<input id="navbar-1-toggle" class="peer hidden" type="checkbox" />
	<label for="navbar-1-toggle" class="fixed inset-0 hidden max-lg:peer-checked:block"></label>
	<div class="collapse-title navbar">
		<div class="navbar-start">
			<label for="navbar-1-toggle" class="btn btn-ghost lg:hidden">
				<svg
					aria-label="Menu"
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h8m-8 6h16"
					/></svg
				>
			</label>
		</div>
		<nav class="navbar-center hidden lg:flex">
			<ul class="menu menu-horizontal px-1">
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
	</div>
	<nav class="collapse-content lg:hidden z-1">
		<ul class="menu">
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
</div>
<main class="prose max-w-none!">
	{@render children()}
</main>

<style>
	:global(html, body) {
		height: 100vh;
		overflow: hidden;
		padding: 0;
		margin: 0;
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
	:global(a[href^='https://']) {
		position: relative;
		margin-right: 1rem;

		&::after {
			position: absolute;
			top: -0.3rem;
			right: -0.8rem;
			content: ' \2197';
			font-size: 0.85em;
			margin-left: 4px;
		}
	}
</style>
