/**
 * Pure scoring, filtering, sorting and formatting for the token launch radar.
 *
 * Nothing here touches the network, the clock (callers pass `nowSec`) or the
 * filesystem, so every function is directly testable.
 */

import type { Token } from '../data/tokens.ts';

/** Log-scale floor/ceiling for the liquidity and volume signals. */
export const LIQUIDITY_RANGE: readonly [number, number] = [1_000, 10_000_000];
export const VOLUME_RANGE: readonly [number, number] = [1_000, 10_000_000];
/** Age at which the freshness penalty saturates. */
export const AGE_PENALTY_WINDOW_SEC = 48 * 60 * 60;
/** Composite weights; sum to 1 before the freshness penalty is subtracted. */
export const WEIGHTS = { liquidity: 0.35, volume: 0.3, hype: 0.35 } as const;
/** Maximum points the freshness penalty can remove from a perfect score. */
export const AGE_PENALTY_MAX = 30;

/** Filter values accepted by the HTTP API and the dashboard. */
export interface Filters {
  /** Exact chain match, or undefined for all chains. */
  chain?: string;
  /** Exact launchpad match, or undefined for all launchpads. */
  launchpad?: string;
  /** Minimum `liquidity_usd`. */
  minLiquidity: number;
  /** Drop risk-flagged tokens when true. */
  hideRugged: boolean;
  /** Case-insensitive substring match over name/symbol. */
  q?: string;
}

/** Columns the table and API can sort by. */
export type SortKey =
  | 'score'
  | 'age'
  | 'liquidity'
  | 'volume'
  | 'market_cap'
  | 'hype'
  | 'holders'
  | 'buys';

/** A sort request. `age` ascending means newest first. */
export interface Sort {
  key: SortKey;
  dir: 'asc' | 'desc';
}

/** A token decorated with the derived values the dashboard displays. */
export interface RankedToken extends Token {
  score: number;
  age_seconds: number;
  age_label: string;
}

/** Clamp to the 0-1 unit interval; non-finite input becomes 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Map a value onto 0-1 on a log scale between `floor` and `ceil`.
 *
 * @param value Raw metric, e.g. liquidity in USD.
 * @param floor Value at or below which the result is 0.
 * @param ceil Value at or above which the result is 1.
 * @returns Normalized signal in [0, 1].
 */
export function logScale(value: number, floor: number, ceil: number): number {
  if (!(floor > 0) || !(ceil > floor)) return 0;
  if (!Number.isFinite(value) || value <= floor) return 0;
  return clamp01(Math.log10(value / floor) / Math.log10(ceil / floor));
}

/** Seconds since launch, never negative. */
export function ageSeconds(token: Token, nowSec: number): number {
  return Math.max(0, nowSec - token.launch_ts);
}

/** Human age label: `45s ago`, `12m ago`, `3h ago`, `2d ago`. */
export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

/** Freshness penalty in points, 0 for brand new up to AGE_PENALTY_MAX at 48h. */
export function agePenalty(seconds: number): number {
  return AGE_PENALTY_MAX * clamp01(seconds / AGE_PENALTY_WINDOW_SEC);
}

/**
 * Composite radar score: weighted log-normalized liquidity, volume and hype,
 * minus the freshness penalty. Higher is hotter.
 *
 * @param token Launch to score.
 * @param nowSec Reference time in unix seconds.
 * @returns Score clamped to [0, 100].
 */
export function radarScore(token: Token, nowSec: number): number {
  const liquidity = logScale(token.liquidity_usd, ...LIQUIDITY_RANGE);
  const volume = logScale(token.volume_24h_usd, ...VOLUME_RANGE);
  const hype = clamp01(token.hype_score / 100);
  const base =
    100 *
    (WEIGHTS.liquidity * liquidity + WEIGHTS.volume * volume + WEIGHTS.hype * hype);
  return Math.max(0, Math.min(100, base - agePenalty(ageSeconds(token, nowSec))));
}

/** Attach score, age and age label to a token. */
export function rankToken(token: Token, nowSec: number): RankedToken {
  const seconds = ageSeconds(token, nowSec);
  return {
    ...token,
    score: Math.round(radarScore(token, nowSec) * 100) / 100,
    age_seconds: seconds,
    age_label: formatAge(seconds),
  };
}

/** Compare two ranked tokens on the requested column. */
function compare(a: RankedToken, b: RankedToken, sort: Sort): number {
  const dir = sort.dir === 'asc' ? 1 : -1;
  let delta: number;
  switch (sort.key) {
    case 'age':
      delta = a.age_seconds - b.age_seconds;
      break;
    case 'liquidity':
      delta = a.liquidity_usd - b.liquidity_usd;
      break;
    case 'volume':
      delta = a.volume_24h_usd - b.volume_24h_usd;
      break;
    case 'market_cap':
      delta = a.market_cap_usd - b.market_cap_usd;
      break;
    case 'hype':
      delta = a.hype_score - b.hype_score;
      break;
    case 'holders':
      delta = a.holders - b.holders;
      break;
    case 'buys':
      delta = a.buys - b.buys;
      break;
    case 'score':
    default:
      delta = a.score - b.score;
      break;
  }
  if (delta !== 0) return dir * delta;
  return b.launch_ts - a.launch_ts;
}

/** Keep tokens matching every active filter. */
export function filterTokens(tokens: readonly Token[], filters: Filters): Token[] {
  const q = filters.q?.trim().toLowerCase();
  return tokens.filter((token) => {
    if (filters.chain && token.chain !== filters.chain) return false;
    if (filters.launchpad && token.launchpad !== filters.launchpad) return false;
    if (token.liquidity_usd < filters.minLiquidity) return false;
    if (filters.hideRugged && token.rugged) return false;
    if (q) {
      const haystack = `${token.name} ${token.symbol}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Filter, score and sort a dataset into the API response order. */
export function rankTokens(
  tokens: readonly Token[],
  nowSec: number,
  filters: Filters,
  sort: Sort = { key: 'score', dir: 'desc' },
): RankedToken[] {
  return filterTokens(tokens, filters)
    .map((token) => rankToken(token, nowSec))
    .sort((a, b) => compare(a, b, sort));
}

const SORT_KEYS: readonly SortKey[] = [
  'score',
  'age',
  'liquidity',
  'volume',
  'market_cap',
  'hype',
  'holders',
  'buys',
];

/** Truthy query-string values: `1`, `true`, `yes`, `on`. */
function isTruthy(value: string | null | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/** Coerce a query value to a non-negative number, defaulting to 0. */
function toNumber(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Read filters from a query string. Unknown keys are ignored.
 *
 * @param params Searched params, e.g. `?chain=SOL&min_liquidity=50000&no_rugged=1`.
 * @returns Validated filter values.
 */
export function parseFilters(params: URLSearchParams): Filters {
  return {
    chain: params.get('chain') || undefined,
    launchpad: params.get('launchpad') || undefined,
    minLiquidity: toNumber(params.get('min_liquidity') ?? params.get('minLiquidity')),
    hideRugged: isTruthy(params.get('no_rugged') ?? params.get('hideRugged')),
    q: params.get('q') || undefined,
  };
}

/**
 * Read the sort request from a query string, defaulting to score desc.
 *
 * @param params Searched params, e.g. `?sort=liquidity&dir=asc`.
 * @returns Normalized sort request.
 */
export function parseSort(params: URLSearchParams): Sort {
  const key = params.get('sort') as SortKey | null;
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  return { key: key && SORT_KEYS.includes(key) ? key : 'score', dir };
}

/** Distinct values of a field, sorted, for the dashboard filter dropdowns. */
export function facets(tokens: readonly Token[]): { chains: string[]; launchpads: string[] } {
  return {
    chains: [...new Set(tokens.map((t) => t.chain))].sort(),
    launchpads: [...new Set(tokens.map((t) => t.launchpad))].sort(),
  };
}
