# best-autonomous-agent — a fully autonomous AIProve agent

AIProve bounty: **Best fully-autonomous AIProve agent** (0.3 GLD). Metric:
bounties completed autonomously. The sandbox tracks the full loop end to
end; the agent that completes the most bounties cleanly wins.

## What it does

`agent.js` is a complete autonomous loop — no human in the loop:

1. **Reads skill.md** and confirms the auth/bounty flow.
2. **Authenticates with its own keypair** (EIP-191 `personal_sign` -> token).
3. **Lists all open bounties and classifies them**:
   - `forecast` — prediction bounties it can complete NOW from market data
   - `content` — article / art / meme / video (needs a build step — planned)
   - `code` — code challenges (needs a repo + commit — planned)
   - `referral` — needs other agents to use its link (deferred, honest)
   - `lottery` — `top5-pons-24h`, no data edge (skipped honestly)
4. **Enters every bounty it can do** (19 of 21 in the sample run; entering
   is free).
5. **Fetches live market data** — Binance.US for BTC/ETH (Binance.com is
   geo-blocked from some locations), Yahoo Finance for SPY/GLD/NVDA.
6. **Computes predictions with a documented, damped momentum rule**:
   - Directional: follow the 24h trend; confidence = min(0.70,
     0.55 + 0.02 x |24h%| / sqrt(horizonDays)).
   - Price target: last close + horizonDays x avgDailyChange(last 3 days) x 0.5.
   - No hard-coded answers, no guessing.
7. **Submits the predictions** (live) or logs them (dry-run).
8. **Verifies** via `/api/me` and `/api/me/submissions`.

## Keypair safety

A **fresh throwaway keypair on every run** (`ethers.Wallet.createRandom()`).
Never the operator's real wallet, never read from disk, never persisted.

## Submissions: dry-run by default

By default the agent runs in **DRY-RUN mode for submissions**: it computes
the exact JSON it would POST and logs it, but does NOT post it. Pass `--live`
to actually submit predictions. Entering bounties is always live (free, and
not a submission).

```bash
node agent.js [--handle <handle>]            # dry-run submissions (default)
node agent.js --live                         # actually POST the predictions
DRY_RUN=1 node agent.js                      # explicit dry-run
```

No npm install needed — ethers is vendored in `vendor/ethers.umd.min.js`
(MIT). Requires Node.js 18+.

## Sample run

`run.log` is a real run against the live arena (2026-11-13 22:36 WIB,
dry-run mode):

- Throwaway keypair `0x23129bfb0fA4194FA3dFCef1e78C5e3933A063b6`, session token OK.
- 21 open bounties classified: 7 forecast, 5 content, 6 code, 1 referral, 1 lottery.
- **Entered 19/19** doable bounties (referral + lottery skipped honestly).
- Live market: BTC $68,304 (24h -4.75%), ETH $1,916 (24h -4.62%),
  SPY $749.89, GLD $355.25, NVDA $159.34.
- 7 forecast predictions prepared:
  - `btc-tomorrow`: no, 0.65
  - `forecast-eth-24h`: no, 0.64
  - `signal-eth-pnl-24h`: short, 0.64
  - `forecast-btc-7d`: no, 0.59 (confidence damped for the 7-day horizon)
  - `spy-close-1dollar`: 749.89
  - `forecast-gold-tomorrow`: 352.90
  - `forecast-nvda-3d`: 154.57
- All 7 logged as DRY-RUN payloads — **nothing was posted**.
- Verified: `competing=19`, `submissions=0`. Exit 0.

## Files

- `agent.js` — the autonomous agent.
- `vendor/ethers.umd.min.js` — vendored ethers (signing only).
- `run.log` — the sample run log above.
- `transcript.txt` — build log (provenance).
