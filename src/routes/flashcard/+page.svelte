<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import initSqlJs from 'sql.js';
	import './style.css';
 
	const CATEGORIES = [
		'Technology',
		'literature',
		'science',
		'history',
		'Music',
		'General',
		'Pop culture',
		'Sports',
		'Geography',
		'Other/Obscure'
	];
 
	// -1 to 4 difficulty scale
	const DIFFICULTIES = [
		{ value: '-1', label: 'Unrated' },
		{ value: '0', label: '0 – Trivial' },
		{ value: '1', label: '1 – Easy' },
		{ value: '2', label: '2 – Medium' },
		{ value: '3', label: '3 – Hard' },
		{ value: '4', label: '4 – Expert' }
	];
 
	const LONG_THRESHOLD = 200;
	const SHORT_THRESHOLD = 120;
 
	let db = null;
 
	// ----- state -----
	let category = $state('');
	let difficulty = $state(''); // '' = any
	let search = $state('');
	let lengthFilter = $state(''); // '' | 'long' | 'short'
	let n = $state(1);
 
	let row = $state(null);
	let count = $state(0);
	let loading = $state(true);
	let error = $state(null);
	let flipped = $state(false);
	let filtersOpen = $state(false);
 
	let searchDebounce;
 
	function readParamsFromUrl() {
		const p = $page.url.searchParams;
		category = p.get('category') ?? '';
		difficulty = p.get('difficulty') ?? '';
		search = p.get('q') ?? '';
		lengthFilter = p.get('len') ?? '';
		const rawN = Number(p.get('n'));
		n = Number.isFinite(rawN) && rawN >= 1 ? rawN : 1;
	}
 
	function buildWhere() {
		const clauses = [];
		const params = [];
 
		if (category) {
			clauses.push('category = ?');
			params.push(category);
		}
		if (difficulty !== '') {
			clauses.push('difficulty = ?');
			params.push(Number(difficulty));
		}
		if (search.trim()) {
			clauses.push('(question LIKE ? OR answer LIKE ?)');
			const term = `%${search.trim()}%`;
			params.push(term, term);
		}
		if (lengthFilter === 'long') {
			clauses.push('LENGTH(question) >= ?');
			params.push(LONG_THRESHOLD);
		} else if (lengthFilter === 'short') {
			clauses.push('LENGTH(question) < ?');
			params.push(SHORT_THRESHOLD);
		}
 
		return {
			where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
			params
		};
	}
 
	function runQuery() {
		if (!db) return;
		loading = true;
		error = null;
		try {
			const { where, params } = buildWhere();
 
			const totalStmt = db.prepare(`SELECT COUNT(*) AS count FROM questions ${where}`);
			totalStmt.bind(params);
			count = totalStmt.step() ? totalStmt.getAsObject().count : 0;
			totalStmt.free();
 
			if (count === 0) {
				row = null;
				loading = false;
				return;
			}
 
			// clamp n into valid range
			if (n < 1) n = 1;
			if (n > count) n = count;
 
			const rowStmt = db.prepare(
				`SELECT * FROM questions ${where} ORDER BY problemset LIMIT 1 OFFSET ?`
			);
			rowStmt.bind([...params, n - 1]);
			row = rowStmt.step() ? rowStmt.getAsObject() : null;
			rowStmt.free();
		} catch (e) {
			error = e.message;
			row = null;
		} finally {
			loading = false;
		}
	}
 
	function syncUrl() {
		const params = new URLSearchParams();
		if (category) params.set('category', category);
		if (difficulty !== '') params.set('difficulty', difficulty);
		if (search.trim()) params.set('q', search.trim());
		if (lengthFilter) params.set('len', lengthFilter);
		params.set('n', String(n));
		goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
 
	function applyFilters(resetN = true) {
		if (resetN) n = 1;
		flipped = false;
		syncUrl();
		runQuery();
	}
 
	function onSearchInput() {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => applyFilters(true), 300);
	}
 
	function selectCategory(cat) {
		category = category === cat ? '' : cat;
		applyFilters(true);
	}
 
	function toggleLength(kind) {
		lengthFilter = lengthFilter === kind ? '' : kind;
		applyFilters(true);
	}
 
	function clearFilters() {
		category = '';
		difficulty = '';
		search = '';
		lengthFilter = '';
		applyFilters(true);
	}
 
	function step(delta) {
		flipped = false;
		n = n + delta;
		applyFilters(false);
	}
 
	function randomQuestion() {
		if (count < 1) return;
		flipped = false;
		n = Math.floor(Math.random() * count) + 1;
		applyFilters(false);
	}
 
	onMount(async () => {
		try {
			const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
			const res = await fetch('/questions.db');
			const buffer = await res.arrayBuffer();
			db = new SQL.Database(new Uint8Array(buffer));
 
			readParamsFromUrl();
			runQuery();
		} catch (e) {
			error = e.message;
			loading = false;
		}
	});
</script>
 
<div class="viewbox">
	<div class="page">
		<p class="result-count">
			{#if !loading && !error}
				{count} question{count === 1 ? '' : 's'} match{count === 1 ? 'es' : ''}
				{#if count > 0}&middot; showing #{n}{/if}
			{/if}
		</p>
 
		{#if loading}
			<p class="status">Loading question…</p>
		{:else if error}
			<p class="status error">{error}</p>
		{:else if row}
			<p class="question">{row.question}</p>
		{:else}
			<p class="status">No question found for these filters.</p>
		{/if}
	</div>
</div>
 
<div class="bottom-bar">
	<div class="bottom-bar-inner">
		{#if row}
			<button class="flashcard" onclick={() => (flipped = !flipped)}>
				<div>
					{#if flipped}
						{row.answer}
					{:else}
						<em>Tap to reveal answer</em>
					{/if}
				</div>
			</button>
		{/if}
 
		<div class="fc">
			<div class="nav-row">
				<button onclick={() => step(-1)} disabled={n <= 1}>Back</button>
				<button onclick={randomQuestion} disabled={count < 1}>Random</button>
				<button onclick={() => step(1)} disabled={n >= count}>Next</button>
			</div>
 
			<div class="filters-card">
				<button class="filters-toggle" onclick={() => (filtersOpen = !filtersOpen)}>
					<span>Filters ㅤ</span>
					<span class="chevron" class:open={filtersOpen}>▾</span>
				</button>
 
				{#if filtersOpen}
					<div class="filters-body">
						<div class="field">
							<label for="search">Search question / answer</label>
							<input
								id="search"
								type="text"
								placeholder="Search for a word or phrase…"
								bind:value={search}
								oninput={onSearchInput}
							/>
						</div>
 
						<div class="field-row">
							<!-- <div class="field">
								<label for="difficulty">Difficulty -- WIP</label>
								<select id="difficulty" bind:value={difficulty} onchange={() => applyFilters(true)}>
									<option value="">Any</option>
									{#each DIFFICULTIES as d}
										<option value={d.value}>{d.label}</option>
									{/each}
								</select>
							</div> -->
 
							<div class="field">
								<label for="category-select">Category</label>
								<select
									id="category-select"
									bind:value={category}
									onchange={() => applyFilters(true)}
								>
									<option value="">Any</option>
									{#each CATEGORIES as c}
										<option value={c}>{c}</option>
									{/each}
								</select>
							</div>
						</div>
 
						<div class="field-row checkboxes">
							<label class="checkbox">
								<input
									type="checkbox"
									checked={lengthFilter === 'long'}
									onchange={() => toggleLength('long')}
								/>
								Long only ({LONG_THRESHOLD}+ chars)
							</label>
							<label class="checkbox">
								<input
									type="checkbox"
									checked={lengthFilter === 'short'}
									onchange={() => toggleLength('short')}
								/>
								Short only (&lt;{SHORT_THRESHOLD} chars)
							</label>
						</div>
 
						<div class="category-chips">
							{#each CATEGORIES as c}
								<button
									class="chip"
									class:active={category === c}
									onclick={() => selectCategory(c)}
								>
									{c}
								</button>
							{/each}
						</div>
 
						<button class="clear-btn" onclick={clearFilters}>Clear all filters</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
