// Token Radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board ranks EVERY protocol in the snapshot that records no token (342 of 758): the 40
// watchlist protocols and every pre-token protocol below the floor. 144 of the 342 carry a launch
// flag — they are a wrapped, staked or bridged product of a token that already trades, an exchange,
// or a versioned pool — so the board separates them from the 198 clean launch candidates instead of
// pretending they are launches. A flagged row still gets an implied value (the model's uniform claim
// for the record as it stands) but its farm verdict is SKIP, with the reason stated.
//
// Implied value is fitted from the snapshot's own traded comps, at run time, never from a
// hand-written list of names:
//
//   log(mcap) = a + b * log(tvl)          OLS on the 128 traded comps (mcap > 0)
//   + category residual, shrunk (k = 5)  a category's mean log-residual, pulled toward 0
//   x growth tilt:  1 + clamp(change_7d, -40, 80) / 100 * 0.25
//   x maturity tilt: 0.85 + min(age_days, 1095) / 1095 * 0.30   (age unknown: 365 days)
//
// Growth and age barely predict comps' multiples (r = -0.15 and r = 0.00), so both tilts are
// deliberately small: size and category do the work, the tilts only nudge. The validation numbers
// are computed live from the same comps (leave-one-out and walk-forward) and the dashboard shows
// them; a model that failed its own blind test would not be shipped.
//
// Rank ranges come from 200 bootstrap refits of the comps (seeded PRNG, deterministic): each row
// carries the 10th-90th percentile of its rank across the refits, so the board states how wide
// every implied value really is.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted comps curve and its live validation, all computed from the snapshot at run time. */
export interface Fit {
  /** Intercept of log(mcap) = a + b * log(tvl) on the traded comps. */
  a: number;
  /** Slope of log(mcap) = a + b * log(tvl) on the traded comps. */
  b: number;
  /** Traded comps the fit used (mcap > 0, tvl > 0). */
  n_comps: number;
  /** Category residual adjustments in log space, shrunk toward 0 (k = 5). */
  cat_adj: Record<string, number>;
  /** Leave-one-out RMSE in log space, this model. */
  loo_rmse: number;
  /** Leave-one-out out-of-sample R^2 in log space, this model. */
  loo_r2: number;
  /** Leave-one-out median absolute error as a factor (exp of median |log error|). */
  loo_med_factor: number;
  /** Leave-one-out RMSE in log space, the starter's flat 0.25x model, for the comparison. */
  starter_loo_rmse: number;
  /** Walk-forward RMSE in log space (fit on listed before 2025-06-01, tested after), this model. */
  wf_rmse: number | null;
  /** Walk-forward RMSE in log space, the starter's model. */
  wf_starter_rmse: number | null;
  /** Walk-forward test set size. */
  wf_n: number;
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many bootstrap refits the rank ranges come from. */
export const BOOTSTRAPS = 200;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A row's farm economics, netted to the dollar. */
export interface FarmEcon {
  capital_usd: number;
  setup_gas_usd: number;
  weekly_gas_usd: number;
  hold_days: number;
  weeks: number;
  total_cost_usd: number;
  active_minutes: number;
  cost_per_hour_usd: number;
  break_even_usd: number;
  break_even_share: number;
  pool_75_usd: number;
  /** Share of the 7.5% community pool one farmer must capture to break even. */
  break_even_pool_share: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  verdict_reason: string;
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
  rank_lo: number;
  rank_hi: number;
  launch_flag: string | null;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  econ: FarmEcon;
  model: {
    base_usd: number;
    category_multiplier: number;
    growth_multiplier: number;
    maturity_multiplier: number;
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
  rank_lo: number;
  rank_hi: number;
  launch_flag: string | null;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  econ: FarmEcon;
  base_usd: number;
  category_multiplier: number;
  growth_multiplier: number;
  maturity_multiplier: number;
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

/** A flagged pre-token protocol, kept out of the clean ranking and shown with its reason. */
export interface FlaggedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  flag: string;
  reason: string;
}

/** Coverage accounting: every protocol in the snapshot, accounted for. */
export interface Coverage {
  scanned: number;
  pre_token: number;
  clean: number;
  flagged: number;
  watchlist: number;
  live: number;
}

/** Everything the dashboard needs: the board, the live set, the flagged set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  fit: Fit;
  model_version: string;
  coverage: Coverage;
  rows: RadarRow[];
  live: LiveRow[];
  flagged: FlaggedRow[];
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

/** A deterministic PRNG (mulberry32) so bootstrap refits are byte-identical on every run. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** The watchlist's wrapped/staked wording rule. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** The watchlist's exchange-name rule. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Why a pre-token protocol is NOT a clean launch candidate, or null when it is clean. The rule is
 * the watchlist's own, applied to the whole pre-token universe: a wrapped, staked or bridged
 * product of a token that already trades, an exchange, or a versioned pool is not a protocol still
 * waiting on a launch of its own.
 */
export function launchFlag(p: SnapshotProtocol): string | null {
  if (p.category === 'CEX') return 'exchange';
  if (p.category === 'Bridge' || p.category === 'Canonical Bridge') return 'bridge product';
  if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') return 'staked product';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped/staked product';
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return 'exchange product';
  if (VERSIONED.test(p.name)) return 'versioned pool';
  return null;
}

/** The human reason a launch flag applies. */
export function flagReason(p: SnapshotProtocol, flag: string): string {
  if (flag === 'exchange') return 'A centralised exchange: its token, if any, is the exchange’s own, not a protocol launch to farm.';
  if (flag === 'bridge product') return 'A bridge: it moves a token that already trades between chains instead of issuing one of its own.';
  if (flag === 'staked product') return 'A staked product: it wraps a token that already trades, so there is no new launch to farm.';
  if (flag === 'wrapped/staked product') return 'Its name marks it a wrapped or staked product of a token that already trades.';
  if (flag === 'exchange product') return 'Its name starts with an exchange’s name: a product of that exchange, not a standalone launch.';
  return 'Its name ends in a version marker: a versioned pool of another protocol, not a launch of its own.';
}

/** The traded comps the curve is fitted on: market cap above zero, TVL above zero. */
function tradedComps(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  return protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
}

/** Ordinary least squares of log(mcap) on log(tvl): {a, b}. */
function olsFit(comps: SnapshotProtocol[]): { a: number; b: number } {
  const n = comps.length;
  let mx = 0;
  let my = 0;
  for (const p of comps) {
    mx += Math.log(p.tvl_usd);
    my += Math.log(p.mcap_usd!);
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  for (const p of comps) {
    const dx = Math.log(p.tvl_usd) - mx;
    sxy += dx * (Math.log(p.mcap_usd!) - my);
    sxx += dx * dx;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** Category residual adjustments in log space, shrunk toward 0 with k = 5. */
function categoryAdjustments(comps: SnapshotProtocol[], a: number, b: number): Record<string, number> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const p of comps) {
    const r = Math.log(p.mcap_usd!) - (a + b * Math.log(p.tvl_usd));
    const cat = p.category ?? 'Other';
    const cur = sums.get(cat) ?? { sum: 0, n: 0 };
    cur.sum += r;
    cur.n += 1;
    sums.set(cat, cur);
  }
  const out: Record<string, number> = {};
  for (const [cat, v] of [...sums.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    out[cat] = v.sum / (v.n + 5);
  }
  return out;
}

/** The starter's flat model, for the validation comparison: log implied value. */
function starterLogImplied(p: SnapshotProtocol, asOf: string): number {
  const growth = Math.min(120, Math.max(-60, finite(p.change_7d, 0)));
  const growthMult = 1 + (growth / 100) * 0.5;
  const age = ageDays(asOf, p.listed_at) ?? 365;
  const maturityMult = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
  return Math.log(Math.max(1, p.tvl_usd * 0.25 * growthMult * maturityMult));
}

/** This model's log implied value under a given fit. */
function modelLogImplied(p: SnapshotProtocol, asOf: string, a: number, b: number, catAdj: Record<string, number>): number {
  const base = a + b * Math.log(p.tvl_usd) + (catAdj[p.category ?? 'Other'] ?? 0);
  const growth = Math.min(80, Math.max(-40, finite(p.change_7d, 0)));
  const growthMult = 1 + (growth / 100) * 0.25;
  const age = ageDays(asOf, p.listed_at) ?? 365;
  const maturityMult = 0.85 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.3;
  return base + Math.log(growthMult * maturityMult);
}

/**
 * Fit the comps curve on the snapshot's traded protocols and validate it out of sample:
 * leave-one-out over all comps, and walk-forward (fit on listed before 2025-06-01, tested after).
 * Every number here is computed from the snapshot at run time.
 */
export function fitComps(snapshot: Snapshot): Fit {
  const comps = tradedComps(snapshot.protocols);
  const { a, b } = olsFit(comps);
  const catAdj = categoryAdjustments(comps, a, b);
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const meanY = ys.reduce((s, y) => s + y, 0) / ys.length;

  let sse = 0;
  let sseStarter = 0;
  let sst = 0;
  const absErrs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.slice(0, i).concat(comps.slice(i + 1));
    const f = olsFit(rest);
    const adj = categoryAdjustments(rest, f.a, f.b);
    const pred = modelLogImplied(comps[i]!, snapshot.as_of, f.a, f.b, adj);
    const err = pred - ys[i]!;
    sse += err * err;
    absErrs.push(Math.abs(err));
    const errS = starterLogImplied(comps[i]!, snapshot.as_of) - ys[i]!;
    sseStarter += errS * errS;
    sst += (ys[i]! - meanY) * (ys[i]! - meanY);
  }
  absErrs.sort((x, y) => x - y);
  const medAbs = absErrs[Math.floor(absErrs.length / 2)]!;
  const looRmse = Math.sqrt(sse / comps.length);
  const looR2 = sst === 0 ? 0 : 1 - sse / sst;

  // Walk-forward: the time axis is listed_at; fit on the older half, test on the newer.
  const cut = Date.parse('2025-06-01T00:00:00Z');
  const train = comps.filter((p) => p.listed_at !== null && Date.parse(`${p.listed_at}T00:00:00Z`) < cut);
  const test = comps.filter((p) => p.listed_at !== null && Date.parse(`${p.listed_at}T00:00:00Z`) >= cut);
  let wfRmse: number | null = null;
  let wfStarterRmse: number | null = null;
  if (train.length >= 10 && test.length >= 5) {
    const f = olsFit(train);
    const adj = categoryAdjustments(train, f.a, f.b);
    let s = 0;
    let sS = 0;
    for (const p of test) {
      const e = modelLogImplied(p, snapshot.as_of, f.a, f.b, adj) - Math.log(p.mcap_usd!);
      s += e * e;
      const eS = starterLogImplied(p, snapshot.as_of) - Math.log(p.mcap_usd!);
      sS += eS * eS;
    }
    wfRmse = Math.sqrt(s / test.length);
    wfStarterRmse = Math.sqrt(sS / test.length);
  }

  return {
    a,
    b,
    n_comps: comps.length,
    cat_adj: catAdj,
    loo_rmse: looRmse,
    loo_r2: looR2,
    loo_med_factor: Math.exp(medAbs),
    starter_loo_rmse: Math.sqrt(sseStarter / comps.length),
    wf_rmse: wfRmse,
    wf_starter_rmse: wfStarterRmse,
    wf_n: test.length,
  };
}

/** The three multipliers and the implied value one protocol gets under the fitted curve. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: Fit,
): { implied: number; base: number; catMult: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const growth = Math.min(80, Math.max(-40, finite(protocol.change_7d, 0)));
  const growthMult = 1 + (growth / 100) * 0.25;
  const ageForModel = age ?? 365;
  const maturityMult = 0.85 + (Math.min(Math.max(ageForModel, 0), 1095) / 1095) * 0.3;
  const catMult = Math.exp(fit.cat_adj[protocol.category ?? 'Other'] ?? 0);
  const base = Math.exp(fit.a + fit.b * Math.log(protocol.tvl_usd)) * catMult;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, base: Math.round(base), catMult, growthMult, maturityMult, age };
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

/** One row's farm economics, netted to the dollar. */
export function farmEconomics(p: SnapshotProtocol, implied: number, flag: string | null, age: number | null): FarmEcon {
  const capital = capitalFor(p);
  const setupGas = capital >= 150 ? 8 : 4;
  const weeklyGas = 2;
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const totalCost = setupGas + weeklyGas * weeks;
  const activeMinutes = 15 + 10 * weeks;
  const costPerHour = totalCost / (activeMinutes / 60);
  const breakEvenShare = implied > 0 ? totalCost / implied : 1;
  const pool75 = 0.075 * implied;
  const breakEvenPoolShare = pool75 > 0 ? totalCost / pool75 : 1;
  let verdict: 'FARM' | 'THIN' | 'SKIP';
  let verdictReason: string;
  if (flag !== null) {
    verdict = 'SKIP';
    verdictReason = `No new launch to farm: flagged as ${flag}.`;
  } else if (implied >= 25_000_000 && breakEvenShare < 0.001) {
    verdict = 'FARM';
    verdictReason = `Implied $${(implied / 1e6).toFixed(0)}M with break-even at ${fmtShare(breakEvenShare)} of it.`;
  } else if (implied >= 1_000_000) {
    verdict = 'THIN';
    verdictReason = `Implied $${(implied / 1e6).toFixed(2)}M: worth a small position, not a large one.`;
  } else {
    verdict = 'SKIP';
    verdictReason = `Implied $${implied.toLocaleString('en-US')} is too small for the attention it costs.`;
  }
  return {
    capital_usd: capital,
    setup_gas_usd: setupGas,
    weekly_gas_usd: weeklyGas,
    hold_days: hold,
    weeks,
    total_cost_usd: totalCost,
    active_minutes: activeMinutes,
    cost_per_hour_usd: Math.round(costPerHour * 100) / 100,
    break_even_usd: totalCost,
    break_even_share: Math.round(breakEvenShare * 1e8) / 1e8,
    pool_75_usd: Math.round(pool75),
    break_even_pool_share: Math.round(breakEvenPoolShare * 1e8) / 1e8,
    verdict,
    verdict_reason: verdictReason,
  };
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
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
  if (c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** A share as a readable percentage: tiny shares get six decimals so they do not print as 0.0000%. */
export function fmtShare(share: number): string {
  return `${(share * 100).toFixed(6)}%`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age, flag), never from a hand-written list of names.
 * Flagged rows get an honest skip plan: what the protocol is, and what to do instead of farming a launch.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, flag: string | null, econ: FarmEcon, implied: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = econ.capital_usd;
  const hold = econ.hold_days;
  if (flag !== null) {
    const reason = flagReason(p, flag);
    return [
      { text: `${reason}`, cost: 'nothing to spend', time: '2 minutes to read' },
      { text: `Do not farm ${p.name} as a token launch: there is no new token coming from it to claim.`, cost: '$0, and the position you skip costs nothing', time: 'no time spent' },
      { text: `If you want exposure to ${p.name}, use it for what it is — a ${flag} — and judge it on its own yield.`, cost: `from $${capital} if you use it, otherwise $0`, time: '15 minutes to set up' },
      { text: `Watch the parent protocol whose token already trades instead: a launch, if one ever comes, would be announced there.`, cost: 'nothing but attention', time: '5 minutes a week' },
      { text: `Before you act on any claim link about ${p.name}, open the protocol's own page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`, cost: 'nothing but the log', time: '5 minutes' },
    ];
  }
  const action = actionFor(p, capital, chain);
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: action, cost: `$${capital} of capital and about $${econ.setup_gas_usd} of gas`, time: '15 minutes to set up' },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: `about $${econ.weekly_gas_usd} of gas a week`, time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    {
      text: `Break-even: this farm costs $${econ.total_cost_usd} out of pocket over ${hold} days, so your allocation must be worth $${econ.total_cost_usd} — ${fmtShare(econ.break_even_share)} of the $${implied.toLocaleString('en-US')} implied value, or ${fmtShare(econ.break_even_pool_share)} of a 7.5% community pool ($${econ.pool_75_usd.toLocaleString('en-US')}). Verdict: ${econ.verdict} — ${econ.verdict_reason}`,
      cost: `$${econ.total_cost_usd} total, $${econ.cost_per_hour_usd} per active hour`,
      time: `${econ.active_minutes} active minutes over ${hold} days`,
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
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

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n and bootstrap rank ranges. */
export function buildBoard(snapshot: Snapshot, fit: Fit): BoardRow[] {
  const comps = tradedComps(snapshot.protocols);
  const index = bySlug(snapshot.protocols);
  // Every pre-token protocol in the snapshot is ranked: the watchlist is the floor, never the ceiling.
  const chosen = snapshot.protocols.filter((p) => isPreToken(p));
  // Coverage is a gate row: every watchlist slug must appear, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    if (!chosen.some((p) => p.slug === slug)) {
      const p = index.get(slug);
      if (p !== undefined) chosen.push(p);
    }
  }
  const scored = chosen.map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit);
    const flag = launchFlag(p);
    const econ = farmEconomics(p, v.implied, flag, v.age);
    return { p, v, flag, econ };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  // Bootstrap rank ranges: resample the comps with replacement (seeded, deterministic), refit,
  // re-rank, and take each row's 10th-90th percentile rank over BOOTSTRAPS refits.
  const rng = mulberry32(20261114);
  const rankSamples = new Map<string, number[]>();
  for (const s of scored) rankSamples.set(s.p.slug, []);
  for (let k = 0; k < BOOTSTRAPS; k++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const f = olsFit(sample);
    const adj = categoryAdjustments(sample, f.a, f.b);
    const refit = scored
      .map((s) => ({ slug: s.p.slug, implied: Math.max(1, Math.round(Math.exp(modelLogImplied(s.p, snapshot.as_of, f.a, f.b, adj)))) }))
      .sort((x, y) => y.implied - x.implied || (x.slug < y.slug ? -1 : 1));
    refit.forEach((r, i) => rankSamples.get(r.slug)!.push(i + 1));
  }
  const rangeOf = (slug: string): { lo: number; hi: number } => {
    const arr = [...rankSamples.get(slug)!].sort((x, y) => x - y);
    const lo = arr[Math.floor(0.1 * (arr.length - 1))]!;
    const hi = arr[Math.floor(0.9 * (arr.length - 1))]!;
    return { lo, hi };
  };

  return scored.map((s, i) => {
    const range = rangeOf(s.p.slug);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.v.age,
      implied_value_usd: s.v.implied,
      rank_lo: range.lo,
      rank_hi: range.hi,
      launch_flag: s.flag,
      verdict: s.econ.verdict,
      econ: s.econ,
      model: {
        base_usd: s.v.base,
        category_multiplier: round4(s.v.catMult),
        growth_multiplier: round4(s.v.growthMult),
        maturity_multiplier: round4(s.v.maturityMult),
        age_days: s.v.age,
      },
      farm_steps: farmSteps(s.p, s.v.age, s.flag, s.econ, s.v.implied).map(stepText),
    };
  });
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
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
    rank_lo: row.rank_lo,
    rank_hi: row.rank_hi,
    launch_flag: row.launch_flag,
    verdict: row.verdict,
    econ: row.econ,
    base_usd: row.model.base_usd,
    category_multiplier: row.model.category_multiplier,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitComps(snapshot);
  const board = buildBoard(snapshot, fit);
  const live = liveRows(snapshot);
  const flagged: FlaggedRow[] = board
    .filter((r) => r.launch_flag !== null)
    .map((r) => {
      const p = snapshot.protocols.find((x) => x.slug === r.slug)!;
      return { slug: r.slug, name: r.name, category: r.category, tvl_usd: r.tvl_usd, flag: r.launch_flag!, reason: flagReason(p, r.launch_flag!) };
    });
  const preToken = snapshot.protocols.filter(isPreToken).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    fit,
    model_version: MODEL_VERSION,
    coverage: {
      scanned: snapshot.protocols.length,
      pre_token: preToken,
      clean: board.filter((r) => r.launch_flag === null).length,
      flagged: flagged.length,
      watchlist: snapshot.watchlist.length,
      live: live.length,
    },
    rows: board.map(radarRow),
    live,
    flagged,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
