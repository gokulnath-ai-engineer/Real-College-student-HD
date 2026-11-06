# Real College Student HD

A browser-playable Three.js college-life open-world vertical slice set in a stylized, source-grounded CMS College of Engineering / Namakkal district edge. It uses original procedural geometry plus one approved original campus-shuttle model; it does not contain GTA assets, names, logos, characters or map geometry.

## Quick start

```bash
pnpm install
pnpm dev --host 0.0.0.0 --port 3000
```

Then open the Vite URL. For a production build and checks:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke
```

The current managed project directory is `/home/ubuntu/collegehd`. `pnpm build` writes `dist/`; `pnpm smoke` serves that production bundle and validates title boot, movement, time, pause/settings, completion, locale and mobile HUD behavior.

## Delivered gameplay

Create a named male or female student and choose hostel or day-scholar life. Explore a stylized CMSCE campus with a main gate, classrooms, engineering labs, library, canteen, hostel quad, placement cell and sports ground. Continue onto an Eranapuram/Namakkal district edge with shops, bus-stand transport, a hill-temple view and traffic.

Walk, sprint, jump, dash, interact with a bike, car or college bus, and follow a first-year mission arc covering attendance, project submission, lab orientation, placement preparation and campus activity. Attendance, money, reputation, inventory, mission progress and day/clock state persist locally. The game has clear/overcast/monsoon weather, a day/night light cycle, scheduled student/faculty NPC routes, traffic, minimap, map, phone, inventory, settings and save/load feedback.

Semester exams, richer sport simulations, club/symposium/hackathon content, placement interviews and graduation are modeled as documented extension points rather than falsely presented as full AAA systems in this vertical slice. See `docs/README.md` for the extension map.

## Repository map

- `src/engine/`: loop, input, Rapier physics, renderer, audio, assets, save and i18n.
- `src/game/game.ts`: simulation coordinator, time/weather, missions, interactions and persistence hooks.
- `src/game/world.ts`: campus/city district, buildings, roads, NPC schedules, traffic, weather and landmarks.
- `src/game/player.ts`: original readable student avatar and movement controller.
- `src/ui/ui.ts`, `src/styles/`: title, HUD, mission rail, minimap, phone, inventory, settings, pause and results.
- `assets/models/`: generated campus-shuttle model input.
- `assets/share/`: game-specific favicon and share cover.
- `docs/public-sources.md`: public facts and fictionalization boundary.
- `docs/assets.md`: asset inventory and licensing boundary.
- `docs/database-schema.md`: versioned local save schema and future data model.
- `docs/README.md`: controls, build/run instructions and extension notes.
- `game-sharing.json`: prepared share metadata.

## Content and copyright boundary

Public facts are limited to institution-level information from CMSCE's official site and broad Namakkal tourism landmark categories. Exact building positions, routes, NPC names, schedules, traffic, prices, dialogue, mission rewards and event outcomes are fictionalized game content. No private data or copied photography is shipped. See `docs/public-sources.md`.

## Licensing

The generated model is original to this project. The bundled Manus fonts are CC0 as documented in `public/fonts/ManusCC0-LICENSE.txt`. Three.js and Rapier retain their upstream licenses.
