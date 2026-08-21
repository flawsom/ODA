# forge-reports

Written by `scripts/forge-bench.ts` (run by the GitHub Actions forge workflows):

- `FORGE_REPORT.md` — the per-letter report
- `forge-results.json` — full per-document results (source, drafts, ratings)
- `forge-manifest.json` — content-hash manifest so re-runs skip forged docs
- `shards/` — per-runner results combined by `--merge`
- `site/` — the browsable GitHub Pages report site (see `scripts/publish-report.mjs`)
