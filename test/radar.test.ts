/**
 * Self-check for the radar scoring and filtering logic.
 *
 * Run with `node --test test/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TOKENS, materializeTokens, type Token } from '../data/tokens.ts';
import {
  AGE_PENALTY_MAX,
  agePenalty,
  facets,
  filterTokens,
  formatAge,
  logScale,
  parseFilters,
  parseSort,
  radarScore,
  rankTokens,
  type Filters,
} from '../lib/radar.ts';

const NOW = 1_800_000_000;
const NO_FILTERS: Filters = { minLiquidity: 0, hideRugged: false };

/** Minimal token fixture; override any field per test. */
function token(overrides: Partial<Token> = {}): Token {
  return {
    id: 't',
    name: 'Test Token',
    symbol: 'TEST',
    chain: 'SOL',
    launchpad: 'pump.fun',
    launch_ts: NOW - 60,
    liquidity_usd: 100_000,
    volume_24h_usd: 100_000,
    market_cap_usd: 1_000_000,
    holders: 100,
    buys: 10,
    sells: 5,
    hype_score: 50,
    rugged: false,
    ...overrides,
  };
}

test('dataset ships 40-60 launches, all within the last 48h', () => {
  assert.ok(TOKENS.length >= 40 && TOKENS.length <= 60, `got ${TOKENS.length}`);
  const nowSec = Math.floor(Date.now() / 1000);
  for (const t of TOKENS) {
    assert.ok(t.launch_ts <= nowSec, `${t.symbol} launched in the future`);
    assert.ok(nowSec - t.launch_ts <= 48 * 60 * 60, `${t.symbol} older than 48h`);
    assert.ok(t.hype_score >= 0 && t.hype_score <= 100, `${t.symbol} hype out of range`);
    assert.ok(t.liquidity_usd >= 0 && t.volume_24h_usd >= 0 && t.market_cap_usd >= 0);
  }
});

test('dataset ids are unique and some tokens are flagged rugged', () => {
  assert.equal(new Set(TOKENS.map((t) => t.id)).size, TOKENS.length);
  const rugged = TOKENS.filter((t) => t.rugged);
  assert.ok(rugged.length > 0, 'expected at least one rugged flag');
  assert.ok(rugged.length < TOKENS.length / 2, 'rugged flags should be a minority');
});

test('materializeTokens derives launch_ts from age, newest first', () => {
  const tokens = materializeTokens(NOW);
  assert.equal(tokens[0]!.id, 'sol-pepe2');
  assert.equal(tokens[0]!.launch_ts, NOW - 4 * 60);
  for (let i = 1; i < tokens.length; i++) {
    assert.ok(tokens[i - 1]!.launch_ts >= tokens[i]!.launch_ts);
  }
  assert.ok(NOW - tokens[tokens.length - 1]!.launch_ts >= 700 * 60);
});

test('logScale clamps below the floor and above the ceiling', () => {
  assert.equal(logScale(0, 1_000, 1_000_000), 0);
  assert.equal(logScale(999, 1_000, 1_000_000), 0);
  assert.equal(logScale(1_000_000, 1_000, 1_000_000), 1);
  assert.equal(logScale(1e12, 1_000, 1_000_000), 1);
  assert.ok(Math.abs(logScale(1_000_000, 1_000, 1e9) - 0.5) < 1e-9);
});

test('logScale returns 0 for non-finite input', () => {
  assert.equal(logScale(Number.NaN, 1_000, 1_000_000), 0);
  assert.equal(logScale(Number.POSITIVE_INFINITY, 1_000, 1_000_000), 0);
  assert.equal(logScale(-1, 1_000, 1_000_000), 0);
  assert.equal(logScale(5, 0, 1_000_000), 0);
});

test('formatAge renders seconds, minutes, hours and days', () => {
  assert.equal(formatAge(0), '0s ago');
  assert.equal(formatAge(45), '45s ago');
  assert.equal(formatAge(59), '59s ago');
  assert.equal(formatAge(60), '1m ago');
  assert.equal(formatAge(12 * 60), '12m ago');
  assert.equal(formatAge(3 * 3_600), '3h ago');
  assert.equal(formatAge(2 * 86_400 + 10), '2d ago');
  assert.equal(formatAge(-5), '0s ago');
});

test('agePenalty grows with age and saturates at the maximum', () => {
  assert.equal(agePenalty(0), 0);
  assert.equal(agePenalty(48 * 60 * 60), AGE_PENALTY_MAX);
  assert.equal(agePenalty(96 * 60 * 60), AGE_PENALTY_MAX);
  assert.ok(agePenalty(24 * 60 * 60) > agePenalty(12 * 60 * 60));
});

test('radarScore stays within 0-100', () => {
  for (const t of TOKENS) {
    const score = radarScore(t, NOW);
    assert.ok(score >= 0 && score <= 100, `${t.symbol} score ${score}`);
  }
});

test('radarScore rises with liquidity, volume and hype', () => {
  const base = token({ liquidity_usd: 50_000, volume_24h_usd: 50_000, hype_score: 40 });
  const richer = token({ liquidity_usd: 5_000_000, volume_24h_usd: 50_000, hype_score: 40 });
  const louder = token({ liquidity_usd: 50_000, volume_24h_usd: 5_000_000, hype_score: 40 });
  const hyped = token({ liquidity_usd: 50_000, volume_24h_usd: 50_000, hype_score: 95 });
  assert.ok(radarScore(richer, NOW) > radarScore(base, NOW));
  assert.ok(radarScore(louder, NOW) > radarScore(base, NOW));
  assert.ok(radarScore(hyped, NOW) > radarScore(base, NOW));
});

test('identical launches score lower as they age', () => {
  const fresh = token({ launch_ts: NOW - 60 });
  const older = token({ launch_ts: NOW - 30 * 3_600 });
  const oldest = token({ launch_ts: NOW - 47 * 3_600 });
  assert.ok(radarScore(fresh, NOW) > radarScore(older, NOW));
  assert.ok(radarScore(older, NOW) > radarScore(oldest, NOW));
});

test('rugged flag does not change the raw score', () => {
  assert.equal(radarScore(token({ rugged: true }), NOW), radarScore(token({ rugged: false }), NOW));
});

test('filterTokens matches chain, launchpad and liquidity independently', () => {
  const tokens = [
    token({ id: 'a', chain: 'SOL', launchpad: 'pump.fun', liquidity_usd: 10_000 }),
    token({ id: 'b', chain: 'ETH', launchpad: 'Uniswap V3', liquidity_usd: 500_000 }),
    token({ id: 'c', chain: 'SOL', launchpad: 'Raydium', liquidity_usd: 900_000 }),
  ];
  assert.deepEqual(
    filterTokens(tokens, NO_FILTERS).map((t) => t.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(filterTokens(tokens, { ...NO_FILTERS, chain: 'SOL' }).map((t) => t.id), ['a', 'c']);
  assert.deepEqual(
    filterTokens(tokens, { ...NO_FILTERS, launchpad: 'Uniswap V3' }).map((t) => t.id),
    ['b'],
  );
  assert.deepEqual(
    filterTokens(tokens, { ...NO_FILTERS, minLiquidity: 100_000 }).map((t) => t.id),
    ['b', 'c'],
  );
});

test('filterTokens drops rugged tokens only when hideRugged is set', () => {
  const tokens = [token({ id: 'safe' }), token({ id: 'bad', rugged: true })];
  assert.equal(filterTokens(tokens, NO_FILTERS).length, 2);
  assert.deepEqual(filterTokens(tokens, { ...NO_FILTERS, hideRugged: true }).map((t) => t.id), [
    'safe',
  ]);
});

test('filterTokens searches name and symbol case-insensitively', () => {
  const tokens = [token({ id: 'a', name: 'Moon Cat', symbol: 'MCAT' }), token({ id: 'b' })];
  assert.deepEqual(filterTokens(tokens, { ...NO_FILTERS, q: 'moon' }).map((t) => t.id), ['a']);
  assert.deepEqual(filterTokens(tokens, { ...NO_FILTERS, q: 'mcat' }).map((t) => t.id), ['a']);
  assert.equal(filterTokens(tokens, { ...NO_FILTERS, q: 'nope' }).length, 0);
});

test('rankTokens sorts by score descending and tags derived fields', () => {
  const ranked = rankTokens(TOKENS, NOW, NO_FILTERS);
  assert.equal(ranked.length, TOKENS.length);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1]!.score >= ranked[i]!.score);
  }
  const top = ranked[0]!;
  assert.equal(typeof top.age_label, 'string');
  assert.ok(top.age_label.endsWith('ago'));
  assert.ok(top.age_seconds >= 0);
});

test('rankTokens sorts by liquidity and supports ascending age', () => {
  const byLiquidity = rankTokens(TOKENS, NOW, NO_FILTERS, { key: 'liquidity', dir: 'desc' });
  for (let i = 1; i < byLiquidity.length; i++) {
    assert.ok(byLiquidity[i - 1]!.liquidity_usd >= byLiquidity[i]!.liquidity_usd);
  }
  const byAgeAsc = rankTokens(TOKENS, NOW, NO_FILTERS, { key: 'age', dir: 'asc' });
  for (let i = 1; i < byAgeAsc.length; i++) {
    assert.ok(byAgeAsc[i - 1]!.age_seconds <= byAgeAsc[i]!.age_seconds);
  }
});

test('rankTokens applies filters before ranking', () => {
  const ranked = rankTokens(TOKENS, NOW, { minLiquidity: 500_000, hideRugged: true, chain: 'SOL' });
  assert.ok(ranked.length > 0);
  for (const t of ranked) {
    assert.equal(t.chain, 'SOL');
    assert.ok(t.liquidity_usd >= 500_000);
    assert.equal(t.rugged, false);
  }
});

test('a brand-new hyped launch outranks an old large one on equal hype', () => {
  const sniper = token({ id: 'new', launch_ts: NOW - 60, hype_score: 90, liquidity_usd: 200_000 });
  const veteran = token({
    id: 'old',
    launch_ts: NOW - 44 * 3_600,
    hype_score: 90,
    liquidity_usd: 200_000,
  });
  assert.ok(radarScore(sniper, NOW) > radarScore(veteran, NOW));
});

test('parseFilters reads chain, launchpad, liquidity, rugged and search', () => {
  const params = new URLSearchParams('chain=SOL&launchpad=pump.fun&min_liquidity=25000&no_rugged=1&q=pepe');
  assert.deepEqual(parseFilters(params), {
    chain: 'SOL',
    launchpad: 'pump.fun',
    minLiquidity: 25_000,
    hideRugged: true,
    q: 'pepe',
  });
});

test('parseFilters defaults to no filtering and rejects junk numbers', () => {
  assert.deepEqual(parseFilters(new URLSearchParams()), {
    chain: undefined,
    launchpad: undefined,
    minLiquidity: 0,
    hideRugged: false,
    q: undefined,
  });
  assert.equal(parseFilters(new URLSearchParams('min_liquidity=-5')).minLiquidity, 0);
  assert.equal(parseFilters(new URLSearchParams('min_liquidity=abc')).minLiquidity, 0);
  assert.equal(parseFilters(new URLSearchParams('no_rugged=0')).hideRugged, false);
});

test('parseSort accepts known keys and falls back to score desc', () => {
  assert.deepEqual(parseSort(new URLSearchParams('sort=liquidity&dir=asc')), {
    key: 'liquidity',
    dir: 'asc',
  });
  assert.deepEqual(parseSort(new URLSearchParams()), { key: 'score', dir: 'desc' });
  assert.deepEqual(parseSort(new URLSearchParams('sort=bogus')), { key: 'score', dir: 'desc' });
});

test('facets lists the distinct chains and launchpads', () => {
  const { chains, launchpads } = facets(TOKENS);
  assert.ok(chains.includes('SOL') && chains.includes('ETH') && chains.includes('BASE'));
  assert.ok(launchpads.includes('pump.fun') && launchpads.includes('Uniswap V3'));
  assert.deepEqual(chains, [...chains].sort());
  assert.deepEqual(launchpads, [...launchpads].sort());
});
