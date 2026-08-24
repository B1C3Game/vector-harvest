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

Pickups are collected only at the endpoint of each segment, never from cells crossed along a segment. A four-command route can therefore harvest at most four pickups. Values `2`, `3`, and `5` remain until collected. Timed values `8` and `13` remain for two turns; the small number beside them shows their remaining lifetime.

Each round contains ten turns. At round end, the current harvest is added to capital and the complete wealth is taxed. Choose one permanent mechanic before the next round: compound pickup yield by `1.5`, increase market density, or reduce wealth tax by two percentage points.

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

This build tests whether movement-driven harvesting remains interesting when player-selected scaling competes with continuous wealth taxation. It intentionally excludes enemies, inventory, terrain, and narrative progression.