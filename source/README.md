# VisionScaleX Account Intelligence

An interactive front end for the five-stage named-account monitoring workflow supplied by the user. Private deployment; imported workbook data; changes are explicitly local to the browser.

## Screens

- Select: editable client context and commercial business unit; named accounts with CSV import, duplicate checks and company profiles.
- Sense: 14 signal definitions with detailed commercial hypotheses, 266 account/signal query rows (42 contain prepared queries), monitoring run-plan export, 80 source results with filters and evidence panels.
- Strike: a conversation queue that separates account commercial fit from event-specific QBC decisions. Manual assessments enforce the supplied enums, relevance strength rules and required rationale.

The imported example is Aranca's project finance advisory workspace: 19 accounts, 14 signal definitions, 80 results, 8 imported assessments. One imported assessment requires review; seven results are excluded. Results and dates are imported evidence, not verified current market facts. The earlier backup workbook contains no completed stage-five decisions and is not used to overwrite the current workbook.

## Source mapping

| Supplied source | Front-end area / model |
|---|---|
| CC- ACCOUNT INTELLIGENCE ENGINE | Client and target context: service, problems, engagements, buying situations, locations and related entities |
| Process client's about us & give signal categories | Eleven-field signal catalog; potential event and buying condition kept distinct from observations |
| all_accounts_search_queries_generation | One account + signal family + objective = one query |
| single_relevancy_checker | Relevance decision, trigger, strength, buyer role and reason |
| relevancy_to_seller_qbc | Account fit and independent YES / POSSIBLE / NO / INSUFFICIENT_INFORMATION conversation assessment |
| Notebook 3.1 | Seller context and signal generation |
| Notebook 3.2 | Named-account enrichment |
| Notebook 3.3 | Account/signal expansion and query generation |
| Notebook 3.4 | Search result collection |
| Notebook 3.5 | Relevance check followed by QBC assessment |
| input_sheet.xlsx | Current imported records |
| input_sheet_before_part5_backup.xlsx | Earlier state, inspected for comparison |

## Deliberate integration boundary

This is a front-end deliverable. It does not scrape websites, call OpenAI or Apify, execute notebooks, schedule jobs, send outreach or claim AI processing has run. Run planning exports a JSON file with the client context, selected accounts, active definitions, available queries, missing-query count and qualification criteria. Missing queries remain missing. Generated profile data is read from the supplied workbook. New accounts await enrichment.

The production processing layer should expose authenticated, tenant-scoped endpoints for seller extraction, account enrichment, catalog generation, query generation, job execution, result ingestion and two separate assessment stages. Keep credentials server-side. Do not execute these notebooks inside a browser. UI state lives in `lib/workspace.ts`; source data is reduced from the workbook to `lib/seed.json` without raw website dumps, notebook outputs or credentials. `components/workspace.tsx` owns interactions. Adapt those actions to the processing API when it is available. Browser storage is a local preview convenience, not shared or production persistence.

## Important source discrepancy

Notebook 3.5 includes `derive_qbc_from_score`, mapping account fit scores 3–5 to QBC YES, whereas the supplied QBC prompt explicitly forbids deriving QBC from that score. The current workbook also contains one RELEVANT result with strength 1 and a contradictory relevance reason. The original imported assessment is retained. The interface holds it for manual review rather than presenting it as a validated opportunity. No uploaded source files were altered.

## Checks

- TypeScript compile check passed.
- Verified counts and imported review state against the workbook.
- Checked high fit cannot automatically qualify a conversation, relevance/strength constraints, missing rationale, stale-criteria behavior, excluded-result gating, CSV parsing, formula-safe export and URL validation.
- Browser checked rendered inbox, review filtering, evidence panel rejection of an incomplete assessment, and monitoring-run scope controls.
- Optional WebMCP registrations are feature-detected: `read_workspace_summary` and `open_signal_result`. Runtime validation was unavailable because the preview browser did not expose modelContext. Ordinary UI use does not depend on WebMCP.

The site uses the supplied Vinext starter and its existing component catalog. Preserve the configured package manager, lockfile and Sites manifest for future changes.
