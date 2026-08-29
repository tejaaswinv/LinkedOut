# LinkedOut entity catalog

LinkedOut keeps university and company pages independent of the organizations themselves.

## University metadata

Use ROR as the canonical open registry source. ROR IDs and metadata are CC0.

```bash
# Enrich only universities already in LinkedOut from the latest ROR release
npm run catalog:ror:latest

# Import every active ROR organization typed as education
npm run catalog:ror:all

# Add descriptions, founding year, Wikipedia links and logo files where Wikidata has them
npm run catalog:wikidata:universities
```

The UI falls back from an explicit `logo_url` to the official domain favicon and finally to an initial, so a missing logo never breaks a page.

## Company catalog

```bash
npm run catalog:companies
npm run catalog:wikidata:companies
```

`data/major-companies.json` is a curated starter catalog of major global, Singaporean and Indian employers using their official domains. It is not presented as a proprietary ranking.

## Ranking imports

Ranking columns are source-neutral on purpose. Only import a ranking dataset when LinkedOut is permitted to republish it.

Convert an authorized/licensed export to CSV with at least `name` and `rank` columns, then run:

```bash
node scripts/import-ranking-csv.mjs universities /path/to/ranking.csv "Provider Name" 2027 "https://source.example/ranking"
node scripts/import-ranking-csv.mjs companies /path/to/ranking.csv "Provider Name" 2026 "https://source.example/ranking"
```

Optional university columns: `score`, `city`, `country`.

Do not automate scraping of a source whose terms prohibit scraping or commercial republication. Store the source URL and provider with imported rankings so public pages can attribute the data correctly.
