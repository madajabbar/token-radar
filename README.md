# Token Radar

A pre-token radar for the make.fun `token-radar-01` competition. It reads a sealed DefiLlama-style
snapshot, scores every protocol that has no token yet, and hands in a ranked board, a static dashboard
and this dossier. Node 22 standard library only: no install, no build, no network.

## Run

```sh
node main.ts --input /input/snapshot.json          # or --input <snapshot.json|directory>
MAKEFUN_OUTPUT_DIR=out node main.ts --input snapshot.json
```

`main.ts` writes `board.json`, `data.js`, copies `dashboard/` and `screenshots/`, then writes
`dossier.json` last (the scorer rebuilds it byte for byte from the output directory). Exit 2 when the
snapshot is missing, exit 1 when the board or the screenshots fail their shape, 0 otherwise.

## The model

Every protocol is scored by one function. No name is special-cased.

```
implied = max(1, round( tvl_usd x growth_mult x maturity_mult x modifier x (1 + tiebreak) ) - adjust)

growth_mult   = 1 + clamp(change_7d, -60, 120) / 100 x 0.5
maturity_mult = 0.6 + min(age_days, 1095) / 1095 x 0.4      (age_days unknown = 365)
modifier      = clamp(0.2, 0.45, 0.25 x category_mult x freshness_mult)
freshness_mult= 1.0 + (1 - min(age_days, 1095) / 1095) x 0.25
```

- `tvl_usd` and `change_7d` come from the snapshot; `age_days` is the time since `listed_at`.
- `category_mult` boosts lending 1.08, restaking 1.07, CDP 1.06, RWA 1.05, liquid staking 1.04 and
  the deepest chains (Ethereum 1.03; Solana, Base, Arbitrum 1.02).
- `freshness_mult` rewards a young protocol: at the same TVL, the younger one ranks higher.
- `tiebreak` is an FNV-1a hash of the slug, so two protocols with equal figures never collide.
- `adjust` is the one-unit pass that walks the sorted board and keeps every implied value strictly
  descending and distinct. The ranking is therefore a total order: ranks 1..N, no ties.

## Board

- The **watchlist** is the floor: every watchlist protocol is on the board, whatever its figures.
- The **early radar** adds the 160 pre-token protocols below the floor, strongest TVL first.
- Protocols that already trade (market cap, gecko id or symbol on record) are set aside as the
  **live** view, where market cap is a fact, not a model.
- CEX categories and versioned pools are skipped: they have no launch to farm.

## Dashboard

`dashboard/` is a static page: `index.html` + `app.css` + `app.js`, reading `window.RADAR` from
`data.js`. It renders the ranked board with sortable columns, filters for category, chain and minimum
TVL, a "hide low freshness" switch, the live-token section, a "how to farm" panel, and a per-protocol
detail drawer with the model's own multipliers and the protocol's six-step farm plan. The page
recomputes each row's implied value with the same arithmetic as `lib/model.ts` and shows whether it
matches `board.json`.

## Files

| Path | Role |
| --- | --- |
| `main.ts` | reads the snapshot, writes the board, data, dashboard, screenshots and dossier |
| `lib/model.ts` | snapshot validation, scoring model, farm plans, board gate |
| `vendor/makefun-board.ts` | the vendored make.fun dossier library (`buildDossier`) |
| `dashboard/` | the static page |
| `screenshots/` | board, detail and filtered views |
| `LICENSE` | MIT |
