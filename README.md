# Vector Harvest: 1 · 2 · 3 · 4

A dependency-free campaign prototype for a score-chasing movement game. Program four fixed-length cardinal vectors in the order you choose, cross valuable pickups before they expire, and build taxed capital across ten rounds.

## Why This Exists

This prototype tests whether a tiny vector language can support satisfying spatial planning, then remain interesting when roguelike scaling competes with continuous wealth taxation.

## Play

Open `index.html` in a browser.

- `1`–`4` chooses a segment length; an arrow appends it to the route.
- `Space` skips a segment.
- A route can contain up to four commands, including repeated lengths such as `4↓, 4←, 3↑, 4→`.
- `Backspace` clears the latest assignment.
- `Delete` resets the complete route.
- `Enter` executes the programmed route; untouched segments are skipped automatically.

At the start of every turn, each length receives `1–4` available uses. One use is most common; repeated lengths become occasional opportunities rather than an unlimited default. The available supply is shown directly on the length buttons and rerolls after execution.

Pickups are collected only at the endpoint of each segment, never from cells crossed along a segment. A four-command route can therefore harvest at most four pickups. Values `2`, `3`, and `5` remain until collected. Timed values `8` and `13` remain for two turns; the small number beside them shows their remaining lifetime.

Every cell entered along a route adds tax whether or not the route harvests anything. Passing through a cell charges half its displayed tax; ending a segment there charges the full amount. A base-tax endpoint costs `0.0025% × round`, with visible `2×` and `5×` outliers. Distance matters, but endpoints matter more: a length-4 segment pays half tax on its first three cells and full tax on its fourth. Re-entering a cell taxes it again; skipped segments add no tax. Pickups are still collected only at segment endpoints.

Each round contains ten turns. At round end, the current harvest is added to capital and the complete wealth is taxed. The bank ledger shows both that round's deduction and the cumulative currency paid across the campaign. Before the next round, choose one of three randomized permanent offers with its rolled value shown upfront.

The Treasury turns cumulative tax into a public benefit: each `100` paid adds one turn to timed pickup lifetime, up to `+2` turns. Round-end choices are three randomized offers drawn from variable yield, market density, timed lifetime, and tax shelter upgrades.

The round economy is:

```text
closing capital = floor((opening capital + harvest) × (1 − wealth tax rate))
```

## Run Locally

No installation or build step is required. Open `index.html` in a modern browser.

## Publish

The included GitHub Actions workflow deploys the game to GitHub Pages on every push to `main`. In the repository settings, set **Pages → Source** to **GitHub Actions** after the first push.

## Playtest Baselines

- First vanilla ten-turn run: `66`
- Practiced vanilla run: `99`
- Search-assisted vanilla run: `157`
- First complete scaling campaign: `11,781` closing capital

## POC Boundary

This build tests whether movement-driven harvesting remains interesting when endpoint tax terrain and player-selected scaling compete with continuous wealth taxation. It intentionally excludes enemies, inventory, special tax-reset pickups, and narrative progression.