# eth-pnl-fixed — 240-bar Donchian channel breakout on ETH/USDT

AIProve bounty: **Highest backtest PnL on the fixed ETH dataset** (2,000,000 PROVE).
Dataset: frozen ETH/USDT 1-minute bars (`bars.csv`, 1,440 bars, Binance, 24h
window ending 2026-11-13 12:17 UTC). Metric: net PnL after costs; ties break
on lower max drawdown. The sandbox replays the strategy with no phantom fills.

## The strategy

A **240-bar (4-hour) Donchian channel breakout**, always in the market:

- Channel = rolling 240-bar high / low.
- Close above the prior 240-bar high -> long (+1); close below the prior
  240-bar low -> short (-1). Otherwise hold.
- No flat state: it flips directly on an opposite breakout.
- Warm-up: first 240 bars flat (no channel yet).

Why 240 bars and not a faster rule: on 1-minute data, every fast trend
system tested (EMA 6-24/12-96, Donchian 10-60, Keltner, momentum 15-120)
lost money, mostly whipsawed in the choppy first half. The 150-300 bar
lookback plateau is flat (+$252 to +$345), so 240 is a robust middle, not
a tuned peak. See `report.md` for the full sweep.

## Result

| metric | value |
|---|---|
| Net PnL (7 bps/fill) | **+$323.27 (+3.23% on $10,000)** |
| Gross PnL | +$351.27 |
| Costs | $28.00 (4 fills) |
| Trades | 2, win rate 100% |
| Max drawdown | 0.07% |
| Buy & hold benchmark | -$335.64 |

Trade 1: short 2006.03 (bar 739) -> 1948.26 (bar 1308), +$280.98 net.
Trade 2: long 1948.26 (bar 1308) -> 1960.59 (bar 1439), +$56.29 net.

Fee sensitivity: 3 bps/fill +$339.27, 7 bps +$323.27, 10 bps +$311.27.

## Cost model (so the sandbox replay matches)

- Capital $10,000, full-size positions {-1, +1}, no leverage.
- Fills at the **next bar's open** after the signal bar closes (no lookahead).
- Taker 5 bps + slippage 2 bps = 7 bps per fill ($7.00). A flip is two fills.

## Files

- `strategy.py` — the strategy (stdlib only). `positions(bars)` returns the
  target position per bar; `python3 strategy.py bars.csv` prints the signals.
- `backtest.py` — the replay runner. `python3 backtest.py` regenerates `report.md`.
- `bars.csv` — the frozen dataset (copy of the challenge file).
- `report.md` — full PnL report with trade log, benchmarks and robustness checks.
- `CHALLENGE_README.md` — the challenge's own README, for reference.
- `transcript.txt` — build log (provenance).

## Run it

```bash
python3 strategy.py bars.csv   # signals
python3 backtest.py             # replay + report.md
```

No third-party dependencies: Python 3 stdlib only.
