# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Siezy/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Siezy/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A working token launch radar. It scans 758 protocols from the sealed snapshot, ranks 342 pre-token protocols, and puts the top 40 on a watchlist, each with a farm plan. The value model is fitted on 128 traded comparables (OLS of log market cap on log TVL, category residuals shrunk toward the global fit, with 7-day growth and maturity tilts), and the entry states its own limits honestly: the comps explain only part of the variance, so every estimate ships with its error range. The dashboard is a static page generated from the same ranked board — no framework, no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Requires Node.js 22.18 or later (standard library only). Output lands in `out/`: the ranked `board.json`, the judge's `dossier.json`, and the dashboard.

---

<sub>Entered on [make.fun](https://make.fun/?ref=y1qp32ce&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
