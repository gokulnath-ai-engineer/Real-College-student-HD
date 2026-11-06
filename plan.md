# Real College Student HD — Implementation Plan

## Product scope

A browser-playable Three.js vertical slice of an original, copyright-safe, GTA-inspired college-life game set around a fictionalized gameplay representation of CMS College of Engineering and Namakkal. Public institutional facts are cited in `docs/public-sources.md`; all invented routes, schedules, names, dialogue and mission outcomes are explicitly labeled game-fictionalized.

The vertical slice prioritizes a fun playable loop over AAA breadth: create a student, choose hostel/day scholar, walk or drive around campus, attend class, complete an assignment, earn money/reputation, use the phone/map/inventory, meet scheduled NPCs, experience time/weather changes, and save/load progress. Story Mode, Free Roam and Side Mission states are represented in the tracker. The data model leaves clear extension points for semesters, exams, sports, clubs, placements and graduation.

## Architecture and project structure

- `src/engine/`: fixed-step loop, input, Rapier physics, renderer, audio, save and i18n infrastructure.
- `src/game/game.ts`: simulation coordinator; owns day clock, missions, weather, NPC schedules, vehicle mode and interactions.
- `src/game/world.ts`: deterministic procedural campus/city map, buildings, roads, landmarks, traffic and interaction zones.
- `src/game/player.ts`: student controller and original procedural student model.
- `src/game/config.ts`: tunable movement, time, vehicle and world values.
- `src/game/rules.ts`: small pure state helpers for attendance, money, reputation and progression.
- `src/ui/ui.ts` and `src/styles/main.css`: modern dark glass HUD, phone, map, inventory, mission tracker, title, pause and settings overlays.
- `src/engine/save.ts`: versioned local save schema for character, semester, attendance, money, inventory, reputation and mission state.
- `assets/models/`: registered generated gameplay model(s); runtime references remain modular.
- `docs/public-sources.md`: source-grounded facts and fictionalization boundary.
- `docs/database-schema.md`: project-owned persistence schema for future managed auth/leaderboards and local save fields.
- `docs/assets.md`: original/procedural/generated asset inventory, licenses and usage notes.
- `docs/README.md`: controls, systems, extension map and build/run instructions.

## Design direction

Three styles were considered: 1) **Campus Noir / teal-and-amber glass HUD** (0.07), 2) **Bright Tamil Nadu travel-poster** (0.06), 3) **Minimal academic whiteboard** (0.04). The selected direction is Campus Noir: a dusk-blue world with warm sodium light, teal interaction markers and amber progress accents.

- **Design movement:** cinematic campus navigation UI meets practical student utility app.
- **Core principles:** readable at a glance; grounded, local and respectful; playful but not criminal; dense information only when requested.
- **Color philosophy:** indigo night gives the world depth; teal marks navigable/interactable systems; amber indicates progress and opportunity; coral marks weather and urgent tasks.
- **Layout paradigm:** edge-anchored HUD with a compact mission rail, minimap in the upper-right and phone/inventory surfaces as slide-over panels rather than a centered dashboard.
- **Signature elements:** teal route pins, amber semester progress ring, and a thin monsoon weather bar.
- **Interaction philosophy:** movement is immediate; contextual `E` interactions turn real campus routines into short rewarding loops.
- **Animation:** subtle float on markers, eased panel slides, gentle sky gradient shift, NPC route motion and restrained HUD pulses.
- **Typography:** bundled ManusCC0 display face for headings, ManusCC0 regular for body; no external font dependency.
- **Brand essence:** a grounded open-campus life sim for students who want to explore, grow and graduate; candid, energetic, local.
- **Brand voice:** “Your timetable is a map.” / “Show up. Skill up. Move forward.”
- **Wordmark:** `RC` monogram inside a rounded route-pin, paired with a compact uppercase wordmark.
- **Signature brand color:** CMS Teal `#48d9c1`.

## Implementation decisions

The game uses the existing fixed-step engine and Rapier colliders, but replaces the floating-island starter layer with a compact campus/city district. The player uses WASD, mouse look, Shift sprint and E interact. `V` toggles a nearby vehicle; `M` toggles the map; `I` toggles inventory; `P` toggles the phone overlay; Esc pauses. Vehicles are modeled as simple high-performance gameplay props; the generated shuttle is integrated as a visual asset when available and falls back to the same original procedural representation if the asset is unavailable at runtime.

The saved Blueprint selected `assetProduction: ai_generated_fast`, rigging/animation and online features `manus_oauth` plus `leaderboard`. Core play remains offline-first. Local progression is always available; the docs describe the optional account/leaderboard integration boundary without making it a prerequisite for this slice.

## Data and content boundary

Public facts currently used: CMSCE is in Eranapuram, Namakkal district; the college describes itself as established in 2007, AICTE-approved, affiliated with Anna University and about 8 km from Namakkal; its site lists classrooms, sports, CSE/ECE/EEE labs, library, transport and placement activities. Namakkal tourism context is limited to publicly described town landmarks and hills. No private data, private student records or copied photography are shipped. Names, exact building positions, NPC schedules, traffic density, dialogue, prices and mission outcomes are fictionalized gameplay content.

## Build and validation

Use `pnpm build`, `pnpm test`, and the existing `pnpm smoke` script after implementation. Start the preview with `pnpm dev --host 0.0.0.0 --port 3000`, then inspect the preview and console. Before the first complete checkpoint, add the game-specific favicon and sharing metadata, run the runtime asset sync if generated assets landed, and follow the managed checkpoint flow.
