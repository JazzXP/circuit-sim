<script lang="ts">
	let { tabs, selectedTab = $bindable() }: { tabs: string[]; selectedTab: string } = $props();
</script>

<ul>
	{#each tabs as item (item)}
		<li class="border">
			<a
				href={'#' + item}
				class:selected={item === selectedTab}
				onclick={(e) => {
					e.preventDefault();
					selectedTab = item;
				}}>{item}</a
			>
		</li>
	{/each}
</ul>

<style>
	ul {
		display: flex;
		flex: 1;
		list-style-type: none;
		gap: 16px;
		margin-inline-end: 0;
		margin-inline-start: 10px;
		padding-inline: 0;
		padding-bottom: 0;
		margin-bottom: -1px;
		z-index: 1;
	}
	.border {
		box-shadow: 0 -5px 10px -5px var(--tertiary-colour);
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
	}
	.border:has(.selected) {
		border-bottom-color: var(--background-colour);
	}
	li {
		padding: 0;
		margin: 0;
		display: flex;
	}

	a {
		display: block;
		flex: 1;
		font-weight: 600;
		font-style: normal;
		text-decoration: none;
		text-align: center;
		color: var(--secondary-colour);
		padding: 8px;
	}

	.selected {
		background: var(--background-colour);
	}
	:global(.tab) {
		display: none;
	}
	:global(div.selected) {
		display: block;
	}
</style>
