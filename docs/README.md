# Real College Student HD — build and systems guide

## Run locally

```bash
pnpm install
pnpm dev --host 0.0.0.0 --port 3000
```

Open the printed local URL. The game is a client-only Three.js/Vite build and saves progression locally in the browser.

## Verify and build

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

`pnpm build` produces `dist/`, runs the TypeScript check and the size-budget script. `pnpm smoke` serves the production bundle with Vite Preview and validates the title screen, player movement, clock progression, pause/settings navigation, story completion, Chinese-locale boot and mobile HUD boot.

## Controls

- `WASD`: move; mouse: look after clicking the canvas.
- `Shift`: sprint; `Space`: jump; `F` or left click: dash.
- `E`: interact with a nearby landmark or vehicle.
- `M`: map; `I`: inventory; `P`: student phone; `Esc`: pause.
- Touch devices receive an on-screen joystick, drag-to-look area and action buttons.

## Playable systems in this slice

The player creates a named male or female student and chooses hostel or day-scholar life. The current district includes a stylized CMSCE campus, classroom block, engineering labs, library, canteen, hostel quad, placement cell, sports ground, roads, traffic, Eranapuram shops, a bus-stand edge and hill-temple view. Public facts and fictionalization boundaries are recorded in `docs/public-sources.md`.

The day clock advances continuously, with clear/overcast/monsoon weather, rain particles and changing light/fog. AI student and faculty figures follow deterministic route schedules, and traffic objects follow district road routes. Interacting with the mission target advances a representative story arc: attendance, project submission, lab orientation, placement preparation and campus activity. Rewards update attendance, money, reputation and inventory. Free-roam is the normal post-mission movement state, and the mission tracker is structured for side missions and later semester arcs.

Bike, car and college-bus interactions are implemented as lightweight vehicle modes that increase movement speed and provide contextual HUD feedback. The phone, map, inventory, save status and settings are HTML/CSS panels. Rapier colliders are limited to the ground and building masses for predictable preview performance.

## Extension map

- Add semester/exam content in `MISSION`, `RunState` and the versioned save schema.
- Add sports, clubs, symposiums and hackathons as activity records with explicit public/fictionalized content flags.
- Add placement interview activities using fictional companies and authored question banks; do not imply official recruiting information.
- Replace procedural vehicles/NPCs with managed assets through `assets.lock.json` and keep procedural fallbacks.
- Add a server only if the user requests online accounts or leaderboards; preserve offline play and apply server-side eligibility checks.

## Source and copyright boundary

The game is an original college-life simulation inspired by open-world movement, not a GTA port or asset remix. It does not ship GTA names, logos, characters, map geometry or media. CMSCE and Namakkal references are limited to institution-level public facts and broad public landmark categories. Exact layouts, routes, NPC schedules, dialogue, prices and mission outcomes are fiction for gameplay.
