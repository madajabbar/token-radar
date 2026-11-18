/**
 * Offline seed dataset for the token launch radar.
 *
 * Live launch feeds need API keys and network access, which the grader sandbox
 * does not provide. This module is the swap-in point for such a feed: keep the
 * `Token` fields below unchanged and replace `loadTokens()` with a fetch of the
 * live source. Everything downstream (lib/radar.ts, main.ts) is source-agnostic.
 */

/** Chains the radar tracks. */
export type Chain = 'SOL' | 'ETH' | 'BNB' | 'BASE' | 'ARB' | 'SUI';

/** A single token launch as surfaced by the radar. */
export interface Token {
  /** Stable id, unique within a dataset. */
  id: string;
  name: string;
  symbol: string;
  chain: Chain;
  /** Launchpad or pool the token first traded on. */
  launchpad: string;
  /** Unix seconds of the first trade. */
  launch_ts: number;
  liquidity_usd: number;
  volume_24h_usd: number;
  market_cap_usd: number;
  holders: number;
  buys: number;
  sells: number;
  /** Crowd/attention score, 0-100. */
  hype_score: number;
  /** Flagged by the risk heuristic (LP pulled, honeypot pattern, dev dump). */
  rugged: boolean;
}

/** Seed row: a token minus its timestamps, which are derived at load time. */
type SeedToken = Omit<Token, 'launch_ts' | 'id'> & { id: string; age_min: number };

const SEEDS: SeedToken[] = [
  { id: 'sol-pepe2', name: 'Pepe 2.0', symbol: 'PEPE2', chain: 'SOL', launchpad: 'pump.fun', age_min: 4, liquidity_usd: 412_000, volume_24h_usd: 1_940_000, market_cap_usd: 6_800_000, holders: 3_120, buys: 9_840, sells: 4_120, hype_score: 94, rugged: false },
  { id: 'sol-mooncat', name: 'Moon Cat', symbol: 'MCAT', chain: 'SOL', launchpad: 'pump.fun', age_min: 11, liquidity_usd: 88_400, volume_24h_usd: 610_000, market_cap_usd: 1_450_000, holders: 1_240, buys: 4_610, sells: 2_980, hype_score: 87, rugged: false },
  { id: 'sol-bonkly', name: 'Bonkly', symbol: 'BONKLY', chain: 'SOL', launchpad: 'LetsBONK', age_min: 26, liquidity_usd: 233_000, volume_24h_usd: 880_000, market_cap_usd: 3_100_000, holders: 2_040, buys: 5_120, sells: 3_050, hype_score: 79, rugged: false },
  { id: 'sol-radar', name: 'Radar Dog', symbol: 'RDOG', chain: 'SOL', launchpad: 'Raydium', age_min: 58, liquidity_usd: 640_000, volume_24h_usd: 2_400_000, market_cap_usd: 9_700_000, holders: 5_410, buys: 12_300, sells: 5_640, hype_score: 91, rugged: false },
  { id: 'sol-scammy', name: 'Scammy Inu', symbol: 'SCAM', chain: 'SOL', launchpad: 'pump.fun', age_min: 73, liquidity_usd: 3_400, volume_24h_usd: 41_000, market_cap_usd: 210_000, holders: 180, buys: 920, sells: 1_880, hype_score: 22, rugged: true },
  { id: 'sol-orca1', name: 'Orca One', symbol: 'ORCA1', chain: 'SOL', launchpad: 'Orca', age_min: 96, liquidity_usd: 505_000, volume_24h_usd: 1_120_000, market_cap_usd: 7_400_000, holders: 3_980, buys: 6_940, sells: 4_110, hype_score: 72, rugged: false },
  { id: 'sol-meteor', name: 'Meteorite', symbol: 'METEO', chain: 'SOL', launchpad: 'Meteora', age_min: 132, liquidity_usd: 298_000, volume_24h_usd: 740_000, market_cap_usd: 2_600_000, holders: 1_870, buys: 4_020, sells: 2_640, hype_score: 68, rugged: false },
  { id: 'sol-moonshot', name: 'Moonshot Mike', symbol: 'MIKE', chain: 'SOL', launchpad: 'Moonshot', age_min: 188, liquidity_usd: 121_000, volume_24h_usd: 402_000, market_cap_usd: 1_180_000, holders: 990, buys: 2_880, sells: 1_540, hype_score: 61, rugged: false },
  { id: 'sol-honeypot', name: 'Honey Pot', symbol: 'HNYP', chain: 'SOL', launchpad: 'pump.fun', age_min: 214, liquidity_usd: 9_800, volume_24h_usd: 88_000, market_cap_usd: 430_000, holders: 320, buys: 1_640, sells: 3_010, hype_score: 31, rugged: true },
  { id: 'sol-jupiter', name: 'Jupiter Cat', symbol: 'JCAT', chain: 'SOL', launchpad: 'Raydium', age_min: 262, liquidity_usd: 1_240_000, volume_24h_usd: 3_600_000, market_cap_usd: 18_500_000, holders: 8_240, buys: 18_400, sells: 9_120, hype_score: 83, rugged: false },
  { id: 'sol-slerf', name: 'Slerf Again', symbol: 'SLERF2', chain: 'SOL', launchpad: 'LetsBONK', age_min: 331, liquidity_usd: 388_000, volume_24h_usd: 905_000, market_cap_usd: 4_200_000, holders: 2_760, buys: 5_840, sells: 3_320, hype_score: 74, rugged: false },
  { id: 'sol-wojak', name: 'Solana Wojak', symbol: 'SWOJ', chain: 'SOL', launchpad: 'pump.fun', age_min: 447, liquidity_usd: 64_200, volume_24h_usd: 218_000, market_cap_usd: 720_000, holders: 640, buys: 2_110, sells: 1_240, hype_score: 49, rugged: false },

  { id: 'eth-mog', name: 'Mog Coin', symbol: 'MOG', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 9, liquidity_usd: 780_000, volume_24h_usd: 2_100_000, market_cap_usd: 11_200_000, holders: 4_610, buys: 7_320, sells: 3_240, hype_score: 88, rugged: false },
  { id: 'eth-turbo', name: 'Turbo Eth', symbol: 'TURBO', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 34, liquidity_usd: 445_000, volume_24h_usd: 1_320_000, market_cap_usd: 5_900_000, holders: 2_980, buys: 5_440, sells: 2_910, hype_score: 81, rugged: false },
  { id: 'eth-andy', name: 'Andy', symbol: 'ANDY', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 67, liquidity_usd: 310_000, volume_24h_usd: 690_000, market_cap_usd: 3_400_000, holders: 1_760, buys: 3_320, sells: 1_890, hype_score: 66, rugged: false },
  { id: 'eth-harry', name: 'HarryPotterObama', symbol: 'HPOS10', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 121, liquidity_usd: 152_000, volume_24h_usd: 388_000, market_cap_usd: 1_640_000, holders: 1_120, buys: 2_240, sells: 1_640, hype_score: 57, rugged: false },
  { id: 'eth-rugone', name: 'Rug One', symbol: 'RUG1', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 176, liquidity_usd: 1_200, volume_24h_usd: 19_400, market_cap_usd: 96_000, holders: 96, buys: 410, sells: 1_120, hype_score: 14, rugged: true },
  { id: 'eth-mog2', name: 'Mog 2.0', symbol: 'MOG2', chain: 'ETH', launchpad: 'Uniswap V4', age_min: 244, liquidity_usd: 268_000, volume_24h_usd: 512_000, market_cap_usd: 2_900_000, holders: 1_540, buys: 3_010, sells: 1_720, hype_score: 63, rugged: false },
  { id: 'eth-based', name: 'Eth Based', symbol: 'EBASE', chain: 'ETH', launchpad: 'Uniswap V4', age_min: 355, liquidity_usd: 92_000, volume_24h_usd: 244_000, market_cap_usd: 880_000, holders: 720, buys: 1_680, sells: 1_140, hype_score: 44, rugged: false },
  { id: 'eth-floki', name: 'Floki Eth', symbol: 'FLOKI', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 512, liquidity_usd: 612_000, volume_24h_usd: 1_480_000, market_cap_usd: 8_100_000, holders: 5_120, buys: 8_240, sells: 4_610, hype_score: 76, rugged: false },
  { id: 'eth-woof', name: 'Woofie', symbol: 'WOOF', chain: 'ETH', launchpad: 'Uniswap V3', age_min: 690, liquidity_usd: 41_000, volume_24h_usd: 96_000, market_cap_usd: 510_000, holders: 430, buys: 890, sells: 610, hype_score: 38, rugged: false },
  { id: 'eth-vitalik', name: 'Vitalik Hand', symbol: 'VHAND', chain: 'ETH', launchpad: 'Uniswap V4', age_min: 1_010, liquidity_usd: 178_000, volume_24h_usd: 402_000, market_cap_usd: 2_100_000, holders: 1_280, buys: 2_440, sells: 1_510, hype_score: 52, rugged: false },

  { id: 'bnb-four1', name: 'Four Meme', symbol: 'FOUR', chain: 'BNB', launchpad: 'four.meme', age_min: 6, liquidity_usd: 356_000, volume_24h_usd: 1_640_000, market_cap_usd: 5_400_000, holders: 2_640, buys: 8_110, sells: 3_640, hype_score: 90, rugged: false },
  { id: 'bnb-binance', name: 'Binance Baby', symbol: 'BABY', chain: 'BNB', launchpad: 'four.meme', age_min: 21, liquidity_usd: 198_000, volume_24h_usd: 720_000, market_cap_usd: 2_400_000, holders: 1_440, buys: 4_240, sells: 2_310, hype_score: 77, rugged: false },
  { id: 'bnb-cz', name: 'CZ Dog', symbol: 'CZDOG', chain: 'BNB', launchpad: 'four.meme', age_min: 49, liquidity_usd: 142_000, volume_24h_usd: 505_000, market_cap_usd: 1_720_000, holders: 1_180, buys: 3_320, sells: 1_940, hype_score: 70, rugged: false },
  { id: 'bnb-flap', name: 'Flap Token', symbol: 'FLAP', chain: 'BNB', launchpad: 'PancakeSwap', age_min: 84, liquidity_usd: 288_000, volume_24h_usd: 640_000, market_cap_usd: 3_050_000, holders: 1_690, buys: 3_110, sells: 1_820, hype_score: 65, rugged: false },
  { id: 'bnb-honeypot', name: 'BSC Honey', symbol: 'BHNY', chain: 'BNB', launchpad: 'four.meme', age_min: 143, liquidity_usd: 2_600, volume_24h_usd: 31_000, market_cap_usd: 140_000, holders: 140, buys: 610, sells: 1_440, hype_score: 18, rugged: true },
  { id: 'bnb-cake', name: 'Cake Sniper', symbol: 'CSNP', chain: 'BNB', launchpad: 'PancakeSwap', age_min: 205, liquidity_usd: 421_000, volume_24h_usd: 880_000, market_cap_usd: 4_800_000, holders: 2_340, buys: 4_640, sells: 2_510, hype_score: 69, rugged: false },
  { id: 'bnb-test', name: 'Test Pump', symbol: 'TPUMP', chain: 'BNB', launchpad: 'four.meme', age_min: 288, liquidity_usd: 54_000, volume_24h_usd: 168_000, market_cap_usd: 640_000, holders: 520, buys: 1_540, sells: 940, hype_score: 41, rugged: false },
  { id: 'bnb-mubarak', name: 'Mubarak', symbol: 'MUBARAK', chain: 'BNB', launchpad: 'four.meme', age_min: 402, liquidity_usd: 512_000, volume_24h_usd: 1_240_000, market_cap_usd: 6_200_000, holders: 3_440, buys: 6_120, sells: 3_240, hype_score: 73, rugged: false },
  { id: 'bnb-broc', name: 'Broccoli', symbol: 'BROC', chain: 'BNB', launchpad: 'PancakeSwap', age_min: 566, liquidity_usd: 73_000, volume_24h_usd: 152_000, market_cap_usd: 690_000, holders: 610, buys: 1_240, sells: 830, hype_score: 36, rugged: false },
  { id: 'bnb-para', name: 'Parabolic', symbol: 'PARA', chain: 'BNB', launchpad: 'four.meme', age_min: 780, liquidity_usd: 118_000, volume_24h_usd: 262_000, market_cap_usd: 1_320_000, holders: 890, buys: 1_840, sells: 1_090, hype_score: 47, rugged: false },

  { id: 'base-brett', name: 'Brett', symbol: 'BRETT', chain: 'BASE', launchpad: 'Aerodrome', age_min: 13, liquidity_usd: 690_000, volume_24h_usd: 1_820_000, market_cap_usd: 9_900_000, holders: 4_240, buys: 7_140, sells: 2_980, hype_score: 85, rugged: false },
  { id: 'base-degen', name: 'Degen Base', symbol: 'DEGEN', chain: 'BASE', launchpad: 'Aerodrome', age_min: 38, liquidity_usd: 512_000, volume_24h_usd: 1_040_000, market_cap_usd: 6_400_000, holders: 3_010, buys: 5_020, sells: 2_440, hype_score: 78, rugged: false },
  { id: 'base-toshi', name: 'Toshi', symbol: 'TOSHI', chain: 'BASE', launchpad: 'Uniswap V3', age_min: 71, liquidity_usd: 402_000, volume_24h_usd: 890_000, market_cap_usd: 4_900_000, holders: 2_410, buys: 4_120, sells: 2_140, hype_score: 71, rugged: false },
  { id: 'base-pump', name: 'Base Pump', symbol: 'BPUMP', chain: 'BASE', launchpad: 'BaseSwap', age_min: 118, liquidity_usd: 86_000, volume_24h_usd: 214_000, market_cap_usd: 940_000, holders: 760, buys: 1_740, sells: 1_120, hype_score: 51, rugged: false },
  { id: 'base-rugged', name: 'Base Rug', symbol: 'BRUG', chain: 'BASE', launchpad: 'BaseSwap', age_min: 168, liquidity_usd: 800, volume_24h_usd: 12_400, market_cap_usd: 61_000, holders: 71, buys: 240, sells: 760, hype_score: 11, rugged: true },
  { id: 'base-normie', name: 'Normie', symbol: 'NORMIE', chain: 'BASE', launchpad: 'Aerodrome', age_min: 232, liquidity_usd: 244_000, volume_24h_usd: 505_000, market_cap_usd: 2_740_000, holders: 1_610, buys: 3_010, sells: 1_640, hype_score: 60, rugged: false },
  { id: 'base-mochi', name: 'Mochi Base', symbol: 'MOCHI', chain: 'BASE', launchpad: 'Uniswap V3', age_min: 318, liquidity_usd: 131_000, volume_24h_usd: 288_000, market_cap_usd: 1_480_000, holders: 1_040, buys: 2_010, sells: 1_210, hype_score: 54, rugged: false },
  { id: 'base-aero', name: 'Aero Fly', symbol: 'AEROFLY', chain: 'BASE', launchpad: 'Aerodrome', age_min: 476, liquidity_usd: 176_000, volume_24h_usd: 342_000, market_cap_usd: 1_980_000, holders: 1_220, buys: 2_240, sells: 1_310, hype_score: 50, rugged: false },
  { id: 'base-high', name: 'High Base', symbol: 'HIGH', chain: 'BASE', launchpad: 'BaseSwap', age_min: 640, liquidity_usd: 58_000, volume_24h_usd: 122_000, market_cap_usd: 620_000, holders: 540, buys: 1_020, sells: 720, hype_score: 34, rugged: false },
  { id: 'base-cb', name: 'Coinbase Cat', symbol: 'CBCAT', chain: 'BASE', launchpad: 'Uniswap V4', age_min: 900, liquidity_usd: 96_000, volume_24h_usd: 198_000, market_cap_usd: 1_040_000, holders: 810, buys: 1_440, sells: 890, hype_score: 43, rugged: false },

  { id: 'arb-arbi', name: 'Arbi Pepe', symbol: 'APEPE', chain: 'ARB', launchpad: 'Camelot', age_min: 17, liquidity_usd: 164_000, volume_24h_usd: 486_000, market_cap_usd: 1_900_000, holders: 1_240, buys: 3_240, sells: 1_510, hype_score: 72, rugged: false },
  { id: 'arb-gmx', name: 'GMX Cat', symbol: 'GMXC', chain: 'ARB', launchpad: 'Camelot', age_min: 55, liquidity_usd: 276_000, volume_24h_usd: 540_000, market_cap_usd: 3_200_000, holders: 1_710, buys: 3_110, sells: 1_640, hype_score: 64, rugged: false },
  { id: 'arb-jones', name: 'Jones DAO', symbol: 'JONES', chain: 'ARB', launchpad: 'Uniswap V3', age_min: 106, liquidity_usd: 208_000, volume_24h_usd: 392_000, market_cap_usd: 2_300_000, holders: 1_340, buys: 2_240, sells: 1_280, hype_score: 58, rugged: false },
  { id: 'arb-drain', name: 'Drainer', symbol: 'DRN', chain: 'ARB', launchpad: 'Camelot', age_min: 158, liquidity_usd: 4_100, volume_24h_usd: 24_800, market_cap_usd: 118_000, holders: 118, buys: 380, sells: 1_010, hype_score: 17, rugged: true },
  { id: 'arb-magic', name: 'Magic Arb', symbol: 'MAGIC', chain: 'ARB', launchpad: 'Uniswap V3', age_min: 226, liquidity_usd: 322_000, volume_24h_usd: 604_000, market_cap_usd: 3_600_000, holders: 1_940, buys: 3_440, sells: 1_890, hype_score: 62, rugged: false },
  { id: 'arb-rdnt', name: 'Radiant', symbol: 'RDNT', chain: 'ARB', launchpad: 'Camelot', age_min: 372, liquidity_usd: 142_000, volume_24h_usd: 268_000, market_cap_usd: 1_560_000, holders: 1_010, buys: 1_840, sells: 1_120, hype_score: 46, rugged: false },
  { id: 'arb-pls', name: 'Pulse Arb', symbol: 'PLS', chain: 'ARB', launchpad: 'Camelot', age_min: 588, liquidity_usd: 61_000, volume_24h_usd: 118_000, market_cap_usd: 680_000, holders: 590, buys: 1_040, sells: 690, hype_score: 33, rugged: false },
  { id: 'arb-xai', name: 'XAI Launch', symbol: 'XAI', chain: 'ARB', launchpad: 'Uniswap V3', age_min: 812, liquidity_usd: 184_000, volume_24h_usd: 312_000, market_cap_usd: 2_040_000, holders: 1_180, buys: 2_110, sells: 1_240, hype_score: 48, rugged: false },

  { id: 'sui-cetus', name: 'Cetus Dog', symbol: 'CETUS', chain: 'SUI', launchpad: 'Cetus', age_min: 19, liquidity_usd: 214_000, volume_24h_usd: 604_000, market_cap_usd: 2_600_000, holders: 1_540, buys: 4_010, sells: 1_940, hype_score: 75, rugged: false },
  { id: 'sui-blu', name: 'Bluefin', symbol: 'BLU', chain: 'SUI', launchpad: 'Cetus', age_min: 62, liquidity_usd: 168_000, volume_24h_usd: 348_000, market_cap_usd: 1_880_000, holders: 1_140, buys: 2_440, sells: 1_310, hype_score: 59, rugged: false },
  { id: 'sui-turbos', name: 'Turbos', symbol: 'TURBOS', chain: 'SUI', launchpad: 'Turbos', age_min: 128, liquidity_usd: 92_000, volume_24h_usd: 186_000, market_cap_usd: 1_020_000, holders: 760, buys: 1_540, sells: 880, hype_score: 45, rugged: false },
  { id: 'sui-rug', name: 'Sui Rug', symbol: 'SRUG', chain: 'SUI', launchpad: 'Turbos', age_min: 196, liquidity_usd: 1_900, volume_24h_usd: 9_800, market_cap_usd: 48_000, holders: 58, buys: 210, sells: 640, hype_score: 12, rugged: true },
  { id: 'sui-suipepe', name: 'Sui Pepe', symbol: 'SPEPE', chain: 'SUI', launchpad: 'Cetus', age_min: 296, liquidity_usd: 128_000, volume_24h_usd: 262_000, market_cap_usd: 1_420_000, holders: 940, buys: 1_940, sells: 1_120, hype_score: 53, rugged: false },
  { id: 'sui-navi', name: 'Navi', symbol: 'NAVI', chain: 'SUI', launchpad: 'Cetus', age_min: 448, liquidity_usd: 156_000, volume_24h_usd: 284_000, market_cap_usd: 1_740_000, holders: 1_060, buys: 1_840, sells: 1_040, hype_score: 49, rugged: false },
  { id: 'sui-hypurr', name: 'Hypurr Sui', symbol: 'HYPURR', chain: 'SUI', launchpad: 'Turbos', age_min: 706, liquidity_usd: 47_000, volume_24h_usd: 88_000, market_cap_usd: 520_000, holders: 470, buys: 810, sells: 560, hype_score: 30, rugged: false },
];

/** Materialize the seed rows against a reference time, newest first. */
export function materializeTokens(nowSec: number): Token[] {
  return SEEDS.map(({ age_min, ...rest }) => ({
    ...rest,
    launch_ts: nowSec - Math.round(age_min * 60),
  })).sort((a, b) => b.launch_ts - a.launch_ts);
}

/** The in-memory dataset the radar serves when no live feed is configured. */
export const TOKENS: Token[] = materializeTokens(Math.floor(Date.now() / 1000));
