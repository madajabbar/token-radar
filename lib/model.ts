// Token Radar's model: the value of a protocol's token before the token exists.
//
// The claim this file makes, and the only one it makes:
//
//   A pre-token protocol's launch market cap is comparable to the market cap its category's live-token
//   protocols carry per dollar of TVL, adjusted for how fast it is growing, how long it has run with no
//   token, and how fresh that run is.
//
// So the multiple is measured off the snapshot's own figures: for every category in the snapshot, the
// median of `mcap_usd / tvl_usd` over the live-token protocols the snapshot records in that category.
// It is never a table of protocol names and never a curve fitted outside the snapshot: the snapshot's
// own live rows are the comparables, and a category the snapshot has no live counterpart for (or fewer
// than two of) falls back to the global median over every live row. `categoryModifier` is that median.
//
// From there the implied value is arithmetic a reader can redo by hand:
//
//   base    = tvl_usd * categoryModifier(protocol)
//   implied = base * growth_multiplier * maturity_multiplier * freshness_multiplier
//
// The three multipliers say what the comparables cannot: a protocol growing faster than its peers
// earns a premium, one that has run for years without a token is not a fresh launch and is discounted,
// and one that has just started is worth more of its category's multiple than its final size suggests.
// Every constant lives in MODEL so the page can print them and the sandbox can change them.
//
// Semantics, deliberately: the multiple is an estimate from the entry's own claim, not a price and not
// a forecast. Anything the snapshot marks as already trading (mcap_usd, gecko_id or symbol present) is
// set aside as a fact and never mixed into this ranking; see `liveRows`.

/** One protocol as the snapshot records it. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The sealed snapshot main.ts reads, with its own floor and watchlist. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants: every number the implied value is built from, so the page can print them. */
export interface ModelConstants {
  /** The multiple used when a category has no live counterpart with at least two rows: the global median. */
  fallback_multiple: number;
  /** The least live rows a category needs before its own median is trusted. */
  min_samples: number;
  /** How far the growth multiplier moves per percent of seven-day change. */
  growth_weight: number;
  /** Seven-day change below this percent is clamped up to it, so a crash cannot zero a row. */
  growth_floor: number;
  /** Seven-day change above this percent is clamped down to it, so one print cannot run away. */
  growth_cap: number;
  /** The maturity multiplier for a protocol with no age on record beside none at all. */
  maturity_floor: number;
  /** How much of the maturity multiplier the age range buys back, up to 1.0. */
  maturity_range: number;
  /** The age in days at which a protocol is fully mature for this model. */
  maturity_days: number;
  /** The age in days assumed when the snapshot lists no date. */
  unknown_age_days: number;
  /** The freshness multiplier for a protocol that has run no days at all. */
  freshness_ceiling: number;
  /** The multiplier above 1 the freshness range adds for the newest protocol. */
  freshness_range: number;
}

export const MODEL: ModelConstants = {
  fallback_multiple: 0.205,
  min_samples: 2,
  growth_weight: 0.6,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1750,
  unknown_age_days: 450,
  freshness_ceiling: 1.0,
  freshness_range: 0.35,
};

/** The model's version: bump it when any arithmetic in this file changes. */
export const MODEL_VERSION = 'radar-3';

/** How many pre-token protocols below the watchlist floor the board carries. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the dashboard's Live tokens view carries. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    comparables: number;
    comparables_sample: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    freshness_multiplier: number;
    category_multiplier: number;
    base_implied_usd: number;
    modifier: number;
    tiebreak: number;
    adjust: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  comparables: number;
  comparables_sample: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  freshness_multiplier: number;
  category_multiplier: number;
  base_implied_usd: number;
  modifier: number;
  tiebreak: number;
  adjust: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The middle of a list of numbers; 0 for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Does the snapshot record this protocol's token as already trading? */
function traded(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

/**
 * Every live-token protocol's market cap per dollar of TVL, by category.
 *
 * This is the whole comparison the model rests on: the snapshot's own trading protocols, divided into
 * the category the snapshot gives them. Nothing is hardcoded and nothing is weighted by hand.
 */
function comparables(pool: SnapshotProtocol[]): { global: number; byCategory: Map<string, number[]> } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of pool) {
    if (!traded(p) || p.tvl_usd <= 0 || p.mcap_usd === null || p.mcap_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(ratio);
    else byCategory.set(key, [ratio]);
  }
  return { global: median(all), byCategory };
}

/**
 * The comparable table a board is scored against: the medians of `mcap_usd / tvl_usd` over the
 * snapshot's live-token protocols, per category and overall. Recomputed once per snapshot, because a
 * snapshot of 758 protocols is 758 divisions and every row of the board reads the same table.
 */
let POOL: SnapshotProtocol[] = [];
let TABLE: { global: number; byCategory: Map<string, number[]> } = { global: 0, byCategory: new Map() };
let TABLE_FOR: SnapshotProtocol[] | null = null;

/** The table for one snapshot's protocols, rebuilt only when the snapshot changes. */
function tableFor(pool: SnapshotProtocol[]): { global: number; byCategory: Map<string, number[]> } {
  if (TABLE_FOR !== pool) {
    TABLE = comparables(pool);
    TABLE_FOR = pool;
  }
  return TABLE;
}

/**
 * The category's comparable multiple: the median `mcap_usd / tvl_usd` of the snapshot's live-token
 * protocols in the same category, or the global median when the category has fewer than
 * `min_samples` of them. This is the one number the implied value is built on.
 *
 * @param p The pre-token protocol being scored.
 * @returns The median multiple of the snapshot's live peers in `p`'s category.
 */
export function categoryModifier(p: SnapshotProtocol): number {
  const table = tableFor(POOL);
  const bucket = table.byCategory.get(p.category ?? 'Other');
  const pick = bucket !== undefined && bucket.length >= MODEL.min_samples
    ? median(bucket)
    : table.global || MODEL.fallback_multiple;
  return round4(pick) || MODEL.fallback_multiple;
}

/** A deterministic 0..1 tiebreak from the slug: a total order for rows the model cannot separate. */
function slugTiebreak(slug: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/** What `impliedValue` worked out, with every input kept so the page can show its arithmetic. */
export interface ImpliedValue {
  base_multiple: number;
  comparables: number;
  comparables_sample: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  freshness_multiplier: number;
  category_multiplier: number;
  base_implied_usd: number;
  modifier: number;
  tiebreak: number;
  adjust: number;
  age_days: number | null;
  raw_usd: number;
}

/**
 * A protocol's implied launch value: its TVL at its category's comparable multiple, moved by growth,
 * maturity and freshness. Pure: the same protocol and model always give the same number.
 *
 * @param protocol The pre-token protocol to score.
 * @param asOf The snapshot's date, for the protocol's age.
 * @param model The constants to score with.
 * @returns The implied value in whole dollars and every multiplier behind it.
 */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): ImpliedValue {
  const age = ageDays(asOf, protocol.listed_at);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, finite(protocol.change_7d, 0)));
  const growth = 1 + (growthPct / 100) * model.growth_weight;
  const bounded = Math.min(Math.max(age ?? model.unknown_age_days, 0), model.maturity_days);
  const maturity = model.maturity_floor + (bounded / model.maturity_days) * model.maturity_range;
  const freshness = model.freshness_ceiling + (1 - bounded / model.maturity_days) * model.freshness_range;
  const table = tableFor(POOL);
  const key = protocol.category ?? 'Other';
  const bucket = table.byCategory.get(key);
  const sample = bucket === undefined ? 0 : bucket.length;
  const comparable = (sample >= model.min_samples ? median(bucket!) : table.global) || model.fallback_multiple;
  const category = round4(comparable) || model.fallback_multiple;
  const baseImplied = Math.round(protocol.tvl_usd * category);
  const raw = Math.max(1, Math.round(baseImplied * growth * maturity * freshness));
  return {
    base_multiple: comparable,
    comparables: category,
    comparables_sample: sample,
    growth_pct: round4(growthPct),
    growth_multiplier: round4(growth),
    maturity_multiplier: round4(maturity),
    freshness_multiplier: round4(freshness),
    category_multiplier: category,
    base_implied_usd: baseImplied,
    modifier: round4(maturity * freshness * growth),
    tiebreak: slugTiebreak(protocol.slug),
    adjust: 0,
    age_days: age,
    raw_usd: raw,
  };
}

/** A versioned release of an existing protocol (a V2, a 2.0): it is not a new protocol to farm. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Does this protocol have no token yet? The snapshot says so three ways; all three must agree. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null && !VERSIONED.test(p.name);
}

/** Is this protocol one the board can rank? Pre-token, a real TVL, and not an exchange's own index. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.tvl_usd > 0 && p.category !== 'CEX' && !p.slug.startsWith('.');
}

/** The snapshot's protocols by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  const index = new Map<string, SnapshotProtocol>();
  for (const p of protocols) index.set(p.slug, p);
  return index;
}

/** A summary's counts as the dashboard needs them: the board's size and where its rows came from. */
export interface BoardSummary {
  rows: BoardRow[];
  early_size: number;
  live_size: number;
}

/**
 * The ranked board: every watchlist protocol, then the pre-token protocols below the floor with the
 * most TVL, ranked by implied value. Ranks are a total order, so no two rows share a value.
 *
 * @param snapshot The sealed snapshot to score.
 * @param model The constants to score with.
 * @returns The ranked rows and the early/live counts.
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const pool = snapshot.protocols;
  POOL = pool;
  TABLE_FOR = null;
  const index = bySlug(pool);
  const onList = new Set(snapshot.watchlist);
  const scored: BoardRow[] = [];
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p && isRankable(p) && !scored.some((r) => r.slug === slug)) scored.push(rowFor(p, snapshot, model, true));
  }
  const below = pool
    .filter((p) => isRankable(p) && !onList.has(p.slug) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  for (const p of below.slice(0, EARLY_ROWS)) scored.push(rowFor(p, snapshot, model, false));
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  // Ranks are a strict order: equal values are lowered by one, strongest slug first, until all differ.
  for (let i = 1; i < scored.length; i++) {
    const prev = scored[i - 1]!;
    const row = scored[i]!;
    if (row.implied_value_usd >= prev.implied_value_usd) {
      row.implied_value_usd = Math.max(1, prev.implied_value_usd - 1);
      row.model.adjust = row.implied_value_usd - Math.max(1, row.model.raw_usd);
    }
  }
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });
  return scored;
}

/** One protocol's row, from the model's own arithmetic. */
function rowFor(p: SnapshotProtocol, snapshot: Snapshot, model: ModelConstants, _onList: boolean): BoardRow {
  const v = impliedValue(p, snapshot.as_of, model);
  return {
    rank: 0,
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    age_days: v.age_days,
    implied_value_usd: v.raw_usd,
    model: {
      base_multiple: v.base_multiple,
      comparables: v.comparables,
      comparables_sample: v.comparables_sample,
      growth_pct: v.growth_pct,
      growth_multiplier: v.growth_multiplier,
      maturity_multiplier: v.maturity_multiplier,
      freshness_multiplier: v.freshness_multiplier,
      category_multiplier: v.category_multiplier,
      base_implied_usd: v.base_implied_usd,
      modifier: v.modifier,
      tiebreak: v.tiebreak,
      adjust: v.adjust,
      age_days: v.age_days,
    },
    farm_steps: farmSteps(p, v.age_days).map(stepText),
  };
}

/** One farm step as the dashboard prints it: the action, then its cost and its time. */
export function stepText(step: FarmStep): string {
  return `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The protocol's own product page, named the way a farmer can find it. */
function siteOf(p: SnapshotProtocol): string {
  return `the ${p.name} app on ${chainOf(p)}`;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step's text as it goes into board.json: 20 to 600 characters is the gate's window. */
function stepLine(s: string): string {
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan follows from the
 * protocol's own record (category, chains, TVL, age) and names no protocol this file does not score.
 *
 * @param p The protocol to plan for.
 * @param age The protocol's age in days, or null when the snapshot lists no date.
 * @returns The steps, in the order a farmer does them.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Open ${siteOf(p)} from a bookmark you saved yourself, and check the points or rewards page it publishes.`,
      cost: 'no fee to look, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live tokens view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => traded(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** One board row as the dashboard carries it: the model's inputs, without the farm steps. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    comparables: row.model.comparables,
    comparables_sample: row.model.comparables_sample,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    freshness_multiplier: row.model.freshness_multiplier,
    category_multiplier: row.model.category_multiplier,
    base_implied_usd: row.model.base_implied_usd,
    modifier: row.model.modifier,
    tiebreak: row.model.tiebreak,
    adjust: row.model.adjust,
  };
}

/**
 * The board and the dashboard's dataset in one pass, so the page and board.json cannot disagree.
 *
 * @param snapshot The sealed snapshot to score.
 * @param model The constants to score with.
 * @returns The ranked board and the compact dataset the dashboard loads.
 */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((row) => !snapshot.watchlist.includes(row.slug)).length;
  return {
    board,
    radar: {
      as_of: snapshot.as_of,
      source: snapshot.source,
      floor_usd: snapshot.floor_usd,
      model,
      model_version: MODEL_VERSION,
      watchlist_size: snapshot.watchlist.length,
      board_size: board.length,
      early_size: early,
      live_size: live.length,
      rows: board.map(radarRow),
      live,
    },
  };
}

/**
 * The snapshot main.ts reads, checked at the door: a bad snapshot is a failed run, never a silent zero.
 *
 * @param text The snapshot file's bytes as text.
 * @returns The parsed snapshot.
 */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('the snapshot is not JSON');
  }
  if (typeof raw !== 'object' || raw === null) throw new SnapshotError('the snapshot is not an object');
  const o = raw as Record<string, unknown>;
  const protocols = o['protocols'];
  const watchlist = o['watchlist'];
  if (!Array.isArray(protocols) || protocols.length === 0) throw new SnapshotError('the snapshot lists no protocols');
  if (!Array.isArray(watchlist) || watchlist.length === 0) throw new SnapshotError('the snapshot lists no watchlist');
  const asOf = typeof o['as_of'] === 'string' ? o['as_of'] : '';
  if (!Number.isFinite(Date.parse(`${asOf}T00:00:00Z`))) throw new SnapshotError('the snapshot has no as_of date');
  const rows: SnapshotProtocol[] = [];
  for (const entry of protocols) {
    if (typeof entry !== 'object' || entry === null) continue;
    const p = entry as Record<string, unknown>;
    const slug = typeof p['slug'] === 'string' ? p['slug'] : '';
    if (slug === '' || /\s/.test(slug)) continue;
    rows.push({
      slug,
      name: typeof p['name'] === 'string' ? p['name'] : slug,
      category: typeof p['category'] === 'string' ? p['category'] : null,
      chains: Array.isArray(p['chains']) ? p['chains'].filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: finite(p['tvl_usd'], 0),
      change_7d: typeof p['change_7d'] === 'number' && Number.isFinite(p['change_7d']) ? p['change_7d'] : null,
      mcap_usd: typeof p['mcap_usd'] === 'number' && Number.isFinite(p['mcap_usd']) ? p['mcap_usd'] : null,
      listed_at: typeof p['listed_at'] === 'string' ? p['listed_at'] : null,
      gecko_id: typeof p['gecko_id'] === 'string' ? p['gecko_id'] : null,
      symbol: typeof p['symbol'] === 'string' ? p['symbol'] : null,
    });
  }
  if (rows.length === 0) throw new SnapshotError('the snapshot lists no usable protocols');
  const floor = finite(o['floor_usd'], 50_000_000);
  const seen = new Set<string>();
  const list: string[] = [];
  for (const slug of watchlist) {
    if (typeof slug !== 'string' || slug === '' || seen.has(slug)) continue;
    seen.add(slug);
    list.push(slug);
  }
  return {
    as_of: asOf,
    source: typeof o['source'] === 'string' ? o['source'] : 'unknown source',
    floor_usd: floor,
    protocols: rows,
    watchlist: list,
  };
}

/**
 * What is wrong with a board, or null when nothing is: the same invariants the gate checks, so a run
 * that would be refused fails here instead.
 *
 * @param board The ranked rows.
 * @param snapshot The snapshot they were scored from.
 * @returns A phrase naming the first problem, or null.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board holds ${board.length} rows: the gate wants at least 100`;
  if (board.length > 4000) return `the board holds ${board.length} rows: the gate wants at most 4000`;
  const known = bySlug(snapshot.protocols);
  const seen = new Set<string>();
  for (const r of board) {
    if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
    if (seen.has(r.slug)) return `${r.slug} appears twice`;
    seen.add(r.slug);
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (typeof r.name !== 'string' || r.name.length === 0) return `${r.slug} has no name`;
  }
  for (const slug of snapshot.watchlist) if (!seen.has(slug)) return `${slug} is on the watchlist and not on the board`;
  for (let i = 1; i < board.length; i++) {
    if ((board[i]!.rank ?? i + 1) !== i + 1) return `rank ${board[i]!.rank} at position ${i + 1}`;
    if (board[i]!.implied_value_usd >= board[i - 1]!.implied_value_usd) return `${board[i]!.slug} does not rank below ${board[i - 1]!.slug}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

/** Unused import guard: `stepLine` is the farm-step clamp the gate's window is measured against. */
void stepLine;
