# MIG Project — Rules-Based Investing System (Crypto + Prediction Markets)

> **Disclaimer (process only):** This document defines an operational process (rules, tracking, automation). It is **not financial advice**, does not recommend any asset, and assumes you will make your own decisions.

## 0) Goal & Constraints
**Goal:** a repeatable, auditable decision system that:
- caps downside via strict **risk limits** and **position sizing**
- enforces **pre-trade checklists** (no impulsive trades)
- tracks every order and thesis for later review
- supports **weekly review** + continuous improvement

**Hard constraints:**
- Every position must have: thesis, invalidation condition, sizing basis, max loss, exit plan.
- No trade without logging.
- No “average down” unless explicitly allowed by the plan.

---

## 1) Accounts / Capital Buckets
Define buckets to prevent cross-contamination of risk:

### Buckets
- **A) Core (long-horizon, low turnover)** — optional; may be disabled.
- **B) Tactical (swing/short-term)** — rule-driven entries/exits.
- **C) Experimental (learning)** — small, capped drawdown.
- **D) Prediction markets** — separate bankroll, separate limits.

### Bankroll rules
- Bucket sizes are set **monthly**; no ad-hoc reallocation.
- If any bucket hits its drawdown limit (see §6), it is **paused** until next review.

---

## 2) Universe & Allowed Instruments
Write down what is allowed **before** trading.

### Crypto universe (example structure)
- Allowed venues: [list exchanges / DEXs]
- Allowed products: spot only / spot+perps / options (choose)
- Disallowed: illiquid assets below $X daily volume; unaudited bridges; tokens without basic custody/withdrawal.

### Prediction markets universe
- Allowed platforms: [Kalshi / Polymarket / Manifold / etc]
- Allowed market types: binary / scalar (choose)
- Disallowed: markets with ambiguous resolution criteria.

---

## 3) Research → Decision Pipeline (Gates)
A trade must pass sequential gates.

### Gate 1 — Eligibility
- Instrument is in allowed universe.
- Liquidity threshold met.
- Venue risk acceptable.

### Gate 2 — Thesis (written)
- **Thesis:** one paragraph.
- **Catalyst / edge:** what information or structure provides edge?
- **Time horizon:** days/weeks/months.
- **Invalidation condition:** what must be true for you to admit you’re wrong?

### Gate 3 — Risk Plan
- **Max loss per trade** (in $ and % of bucket)
- **Exit plan:** take-profit rules + stop/invalidation rules
- **Contingencies:** what if price gaps, market suspends, liquidity vanishes?

### Gate 4 — Sizing & Orders
- Position size computed by rule (see §5).
- Orders defined (limit/market), slippage assumptions, fees.

### Gate 5 — Execute + Log
- Place orders.
- Log immediately.

---

## 4) Strategies (Pick 1–3 to start)
To remain “rules-based,” limit strategy count.

### Strategy templates (process placeholders)
1) **Trend-following (timeframe X):** enter on rule-defined breakout; exit on trailing stop.
2) **Mean reversion (range):** enter on rule-defined deviation; exit at mean/stop.
3) **Event-driven:** enter only when event criteria met; exit on resolution.
4) **Prediction markets:** buy when implied probability diverges from your assessed probability with margin; exit on convergence/hedge.

**Rule:** no discretionary “because it feels cheap.” All entries must map to a strategy.

---

## 5) Position Sizing (Core Rule Set)
Use one sizing method and apply consistently.

### 5.1 Risk-per-trade sizing (recommended for auditability)
Define:
- `BucketEquity` = current equity for that bucket
- `R` = risk per trade (e.g., 0.25%–1% of bucket; choose)
- `StopDistance` = % move to invalidation/stop

Then:
- `MaxLoss$ = BucketEquity * R`
- `PositionNotional$ = MaxLoss$ / StopDistance`

Add constraints:
- **Max notional per position**: e.g., <= X% of bucket
- **Max leverage**: choose 1x unless explicitly allowed

### 5.2 Prediction market sizing
Binary shares payout is bounded, but liquidity/early settlement can matter.
Define:
- `MaxLoss$` per market (cap)
- `MaxExposure$` across correlated markets (cap)

Rule: never exceed bankroll loss cap even if “probability is obvious.”

---

## 6) Risk Limits (Non-Negotiable)
Set these **numerically**. The system should block trades that violate limits.

### 6.1 Per-trade limits
- Max loss per trade: `R` (from §5)
- Max slippage allowance: X bps; if exceeded → no market order.

### 6.2 Per-day / per-week limits
- **Daily loss limit:** if bucket drawdown intraday exceeds X%, stop trading for that day.
- **Weekly loss limit:** if weekly drawdown exceeds Y%, pause bucket until weekly review.

### 6.3 Concentration limits
- Max exposure to one asset: X% of bucket.
- Max exposure to one theme (e.g., L1s, memecoins): Y%.
- Max correlated exposure: define correlation proxy rules.

### 6.4 Operational risk limits
- Max venues in use at once: N.
- If a venue has withdrawal issues or unusual delays → reduce exposure per runbook.

---

## 7) Execution Rules (How Orders Are Placed)
### Order types
- Default: limit orders.
- Market orders allowed only if: liquidity threshold met + slippage check passes.

### Entry discipline
- No “chasing.” If price moves away by more than X%, re-evaluate; do not FOMO.

### Scaling
- Scaling in/out allowed only if pre-defined: e.g., 2 tranches at set levels.
- No adding to losers unless specifically defined (generally disallow early on).

---

## 8) Logging & Tracking (Single Source of Truth)
All trades are recorded in a ledger.

### Required fields (minimum)
- `TradeID`
- `DateTime`
- `Bucket`
- `Instrument`
- `Venue`
- `Strategy`
- `Direction` (long/short/yes/no)
- `EntryPrice`, `Size`, `Notional`
- `Stop/Invalidation`, `TakeProfit`
- `Fees`
- `Thesis`
- `Notes during trade`
- `ExitPrice`, `PnL$`, `PnL%`, `MAE/MFE` (max adverse/favorable excursion)
- `Post-mortem tags` (e.g., “rule break”, “slippage”, “good process”)

### Journaling cadence
- Log at entry.
- Add a short note when you adjust/exit.

---

## 9) Weekly Review (Ritual + Outputs)
Schedule a fixed time weekly.

### Inputs
- Ledger exports
- Equity curve per bucket
- List of trades + rule violations

### Review checklist
1) **Performance by bucket/strategy** (PnL, win rate, expectancy)
2) **Process adherence** (% trades following rules)
3) **Risk metrics** (max drawdown, average R, tail losses)
4) **Execution quality** (slippage, fees, missed fills)
5) **Prediction calibration** (Brier score / log loss for prediction markets)
6) **Top 3 mistakes** + 1 concrete fix each

### Outputs (written)
- Updated parameter values (if any) with justification.
- Updated “allowed universe” changes.
- One experiment to run next week with capped risk.

---

## 10) Automation & Tooling (Recommended Setup)
### Data pipeline
- Pull fills/orders via exchange APIs + prediction market export.
- Normalize into a single table.

### Risk engine
- Pre-trade check that computes:
  - current bucket equity
  - current exposure by asset/theme
  - remaining daily/weekly loss budget
  - allowed max position size
- If any limit breached → “trade blocked” and requires explicit override note.

### Storage
- Start simple: Google Sheet / Airtable.
- Scale: SQLite + a lightweight dashboard.

### Dashboard metrics
- Equity curve per bucket
- Exposure map
- R distribution
- Rule-violation count
- Prediction calibration charts

---

## 11) Templates

### 11.1 Pre-Trade Ticket (copy/paste)
- Bucket:
- Instrument / Market:
- Strategy:
- Thesis (3–5 sentences):
- Invalidation / Stop:
- Take-profit / Exit rules:
- Time horizon:
- Position size calculation:
- Max loss ($ / %):
- Correlation / theme exposure check:
- Order plan (limit/market, levels):

### 11.2 Post-Trade Review
- Result (PnL, R-multiple):
- Did I follow the rules? (Y/N)
- What went right:
- What went wrong:
- One process improvement:

---

## 12) Implementation Plan (4 weeks)
**Week 1:** define buckets, limits, allowed universe; create ledger; do first backfill of past trades.

**Week 2:** implement pre-trade ticket + risk checks; enforce “no log, no trade.”

**Week 3:** automate data pulls; build basic dashboard; compute MAE/MFE + R-multiples.

**Week 4:** formalize weekly review notes + parameter change policy; add prediction calibration metrics.
