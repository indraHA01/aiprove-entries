#!/usr/bin/env node
/**
 * autonomous-agent — a fully autonomous AIProve agent (no human in the loop).
 *
 * Follows https://aiprove.fun/skill.md end to end, then goes further than the
 * sample agent: it classifies every open bounty, enters the ones it can do,
 * fetches live market data, forms its own predictions for the forecast
 * bounties, and submits them — all on its own.
 *
 * Loop:
 *   1. Read skill.md
 *   2. Authenticate with its own keypair (EIP-191 personal_sign -> token)
 *   3. List all open bounties and classify them:
 *        - forecast : prediction bounties it can complete NOW from market data
 *        - content  : article / art / meme / video — needs a build step (planned)
 *        - code     : code challenges — needs a repo + commit (planned)
 *        - referral : needs other agents to use its link (deferred)
 *        - lottery  : top5-pons-24h — no data edge, skipped honestly
 *   4. Enter every bounty it can do (entering is free)
 *   5. Fetch live market data (Binance.US for crypto, Yahoo Finance for
 *      stocks/ETF) and compute predictions with a documented, damped
 *      momentum rule — no guessing, no hard-coded answers
 *   6. Submit the predictions (live) or log them (dry-run)
 *   7. Verify via /api/me and /api/me/submissions
 *
 * KEYPAIR SAFETY — READ THIS:
 * This agent generates a FRESH THROWAWAY keypair on every run
 * (ethers.Wallet.createRandom()). It NEVER uses an operator's real
 * wallet, never reads a private key from disk, and never persists the key.
 *
 * SUBMISSIONS:
 * By default the agent runs in DRY-RUN mode for submissions: it computes
 * the exact JSON it would POST and logs it, but does NOT post it. Pass
 * --live to actually submit predictions. Entering bounties is always live
 * (it is free and is not a submission).
 *
 * Usage:
 *   node agent.js [--handle <handle>] [--live] [--dry-run]
 *   DRY_RUN=1 node agent.js   # explicit dry-run (default)
 *   node agent.js --live       # actually POST the predictions
 *
 * Requires: Node.js 18+. No npm install — ethers is vendored
 * in vendor/ethers.umd.min.js (MIT, https://github.com/ethers-io/ethers).
 */

const { ethers } = require('./vendor/ethers.umd.min.js');

const API = process.env.API_BASE_URL || 'https://aiprove.fun';
const LIVE = process.argv.includes('--live') && !process.argv.includes('--dry-run')
  && process.env.DRY_RUN !== '1';
const HANDLE = (process.argv[process.argv.indexOf('--handle') + 1] || 'autonomous-agent');

const ts = () => new Date().toISOString();
const log = (step, msg) => console.log(`[${ts()}] [${step}] ${msg}`);
const fail = (step, err) => {
  console.error(`[${ts()}] [${step}] FAILED: ${err && err.message ? err.message : err}`);
  process.exit(1);
};

async function getJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}
async function apiGet(path, token) {
  return getJson(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
async function apiPost(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} -> HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// ---------------------------------------------------------------------------
// Market data (public, no keys). Binance.com is geo-blocked from some
// locations, so crypto uses Binance.US with Binance.com as fallback.
// ---------------------------------------------------------------------------
async function binanceKlines(symbol, limit = 25) {
  for (const base of ['https://api.binance.us', 'https://api.binance.com']) {
    try {
      const kl = await getJson(
        `${base}/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`);
      if (Array.isArray(kl) && kl.length > 5) return kl.map((k) => parseFloat(k[4]));
    } catch (e) { /* try next base */ }
  }
  throw new Error(`no Binance data for ${symbol}`);
}

async function yahooDaily(symbol) {
  const d = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const closes = d.chart.result[0].indicators.quote[0].close.filter((c) => c != null);
  if (closes.length < 3) throw new Error(`no Yahoo data for ${symbol}`);
  return closes;
}

async function fetchMarket() {
  log('market', 'fetching live prices (Binance.US for crypto, Yahoo for stocks/ETF)');
  const [btcH, ethH] = await Promise.all([binanceKlines('BTCUSDT'), binanceKlines('ETHUSDT')]);
  const [spy, gld, nvda] = await Promise.all([yahooDaily('SPY'), yahooDaily('GLD'), yahooDaily('NVDA')]);
  const m = {
    BTC: { hourly: btcH, last: btcH[btcH.length - 1], chg24: 100 * (btcH[btcH.length - 1] / btcH[0] - 1) },
    ETH: { hourly: ethH, last: ethH[ethH.length - 1], chg24: 100 * (ethH[ethH.length - 1] / ethH[0] - 1) },
    SPY: { daily: spy, last: spy[spy.length - 1] },
    GLD: { daily: gld, last: gld[gld.length - 1] },
    NVDA: { daily: nvda, last: nvda[nvda.length - 1] },
  };
  log('market', `BTC $${m.BTC.last.toFixed(0)} (24h ${m.BTC.chg24.toFixed(2)}%) | ` +
    `ETH $${m.ETH.last.toFixed(0)} (24h ${m.ETH.chg24.toFixed(2)}%) | ` +
    `SPY $${m.SPY.last.toFixed(2)} | GLD $${m.GLD.last.toFixed(2)} | NVDA $${m.NVDA.last.toFixed(2)}`);
  return m;
}

// ---------------------------------------------------------------------------
// Prediction rules (documented, damped momentum — no hard-coded answers).
// Directional: follow the 24h trend; confidence grows with the move size,
// capped at 0.70, and damped for longer horizons.
// Price target: last close + horizonDays * avgDailyChange(last 3 days) * 0.5.
// ---------------------------------------------------------------------------
function dirPrediction(chg24, horizonDays = 1) {
  const answer = chg24 >= 0 ? 'yes' : 'no';
  const conf = Math.min(0.70, 0.55 + 0.02 * Math.abs(chg24) / Math.sqrt(horizonDays));
  return { answer, confidence: Math.round(conf * 100) / 100 };
}
function pricePrediction(closes, horizonDays) {
  const d = [];
  for (let i = Math.max(1, closes.length - 3); i < closes.length; i++) d.push(closes[i] - closes[i - 1]);
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  const last = closes[closes.length - 1];
  return Math.round((last + horizonDays * avg * 0.5) * 100) / 100;
}

function buildForecastPlan(bounties, m) {
  // slug -> how this agent completes it, using live market data.
  const plan = [];
  const bySlug = Object.fromEntries(bounties.map((b) => [b.slug, b]));
  const add = (slug, payload, why) => {
    if (bySlug[slug]) plan.push({ slug, bounty: bySlug[slug], payload, why });
  };
  const btc = dirPrediction(m.BTC.chg24, 1);
  add('btc-tomorrow', { prediction: btc, handle: HANDLE },
    `BTC 24h ${m.BTC.chg24.toFixed(2)}% — trend says ${btc.answer}`);
  const eth = dirPrediction(m.ETH.chg24, 1);
  add('forecast-eth-24h', { prediction: eth, handle: HANDLE },
    `ETH 24h ${m.ETH.chg24.toFixed(2)}% — trend says ${eth.answer}`);
  add('signal-eth-pnl-24h', { prediction: { direction: m.ETH.chg24 >= 0 ? 'long' : 'short', confidence: eth.confidence }, handle: HANDLE },
    `ETH 24h ${m.ETH.chg24.toFixed(2)}% — momentum ${m.ETH.chg24 >= 0 ? 'long' : 'short'}`);
  const btc7 = dirPrediction(m.BTC.chg24, 7);
  add('forecast-btc-7d', { prediction: btc7, handle: HANDLE },
    `BTC 24h ${m.BTC.chg24.toFixed(2)}%, 7d horizon so confidence damped to ${btc7.confidence}`);
  add('spy-close-1dollar', { prediction: { answer: pricePrediction(m.SPY.daily, 1) }, handle: HANDLE },
    `SPY last $${m.SPY.last.toFixed(2)}, damped 3-day drift -> $${pricePrediction(m.SPY.daily, 1)}`);
  add('forecast-gold-tomorrow', { prediction: { answer: pricePrediction(m.GLD.daily, 1) }, handle: HANDLE },
    `GLD last $${m.GLD.last.toFixed(2)}, damped 3-day drift -> $${pricePrediction(m.GLD.daily, 1)}`);
  add('forecast-nvda-3d', { prediction: { answer: pricePrediction(m.NVDA.daily, 3) }, handle: HANDLE },
    `NVDA last $${m.NVDA.last.toFixed(2)}, 3-day damped drift -> $${pricePrediction(m.NVDA.daily, 3)}`);
  return plan;
}

function classify(b) {
  if (b.slug === 'top5-pons-24h') return 'lottery';
  if (b.slug === 'refer-most-agents') return 'referral';
  if (b.cat === 'forecast' || b.slug.startsWith('forecast-') || b.slug.startsWith('signal-')
    || b.slug === 'btc-tomorrow' || b.slug === 'spy-close-1dollar') return 'forecast';
  if (b.cat === 'content' || b.cat === 'design' || b.cat === 'marketing') return 'content';
  if (b.cat === 'development' || b.cat === 'trading') return 'code';
  return 'other';
}

async function main() {
  log('start', `autonomous-agent starting (API=${API}, live-submit=${LIVE}, handle=${HANDLE})`);

  // 1. Read skill.md
  const skill = await fetch(`${API}/skill.md`).then((r) => {
    if (!r.ok) throw new Error(`skill.md -> HTTP ${r.status}`);
    return r.text();
  });
  log('skill.md', `read ${skill.length} bytes — "${skill.split('\n')[0].replace(/^#\s*/, '')}"`);
  if (!skill.includes('/api/auth/challenge')) throw new Error('skill.md missing auth flow');

  // 2. Throwaway keypair + auth
  const wallet = ethers.Wallet.createRandom();
  log('keypair', `generated THROWAWAY keypair — address ${wallet.address} (random per run, no funds, not persisted)`);
  const { challenge } = await apiGet(`/api/auth/challenge?address=${wallet.address}`);
  const signature = await wallet.signMessage(challenge);
  const session = await apiPost('/api/auth/verify', { address: wallet.address, signature });
  if (!session.token) throw new Error('verify returned no session token');
  const token = session.token;
  log('auth', `session token received, expires ${new Date(session.expiresAt).toISOString()}`);

  // 3. List + classify all open bounties
  const { bounties } = await apiGet('/api/bounties?status=open', token);
  log('bounties', `${bounties.length} open bounties`);
  const groups = {};
  for (const b of bounties) {
    const c = classify(b);
    (groups[c] = groups[c] || []).push(b);
    log('classify', `  [${c}] ${b.slug}: ${b.amt} ${b.unit} (ends ${b.endDate})`);
  }

  // 4. Enter everything it can do (forecast + content + code). Entering is free.
  const doable = [...(groups.forecast || []), ...(groups.content || []), ...(groups.code || [])];
  let entered = 0;
  for (const b of doable) {
    try {
      await apiPost(`/api/bounties/${b.slug}/enter`, { handle: HANDLE }, token);
      entered++;
      log('enter', `entered ${b.slug}`);
    } catch (e) {
      log('enter', `could not enter ${b.slug}: ${e.message}`);
    }
  }
  log('enter', `${entered}/${doable.length} bounties entered (referral + lottery skipped honestly)`);

  // 5. Market data + forecast plan
  const market = await fetchMarket();
  const plan = buildForecastPlan(groups.forecast || [], market);
  log('forecast', `${plan.length} forecast bounties it can complete now from market data`);
  for (const p of plan) log('forecast', `  ${p.slug}: ${JSON.stringify(p.payload.prediction)} — ${p.why}`);

  // 6. Submit (live) or log (dry-run)
  let submitted = 0;
  for (const p of plan) {
    if (LIVE) {
      const r = await apiPost(`/api/bounties/${p.slug}/submit`, p.payload, token);
      submitted++;
      log('submit', `submitted ${p.slug}: ${JSON.stringify(r).slice(0, 160)}`);
    } else {
      log('submit', `DRY-RUN — would POST /api/bounties/${p.slug}/submit ${JSON.stringify(p.payload)}`);
    }
  }

  // 7. Verify
  const me = await apiGet('/api/me', token);
  const subs = await apiGet('/api/me/submissions', token).catch(() => ({ submissions: [] }));
  const competing = (me.competing || []).map((c) => c.slug || c);
  log('verify', `/api/me competing=${competing.length} bounties, submissions=${(subs.submissions || []).length}`);
  log('done', LIVE
    ? `autonomous loop complete: entered ${entered}, submitted ${submitted} forecast predictions`
    : `autonomous loop complete (DRY-RUN): entered ${entered}, ${plan.length} forecast predictions prepared but NOT posted (run with --live to submit)`);
}

main().catch((e) => fail('main', e));
