# Asset inventory

## Runtime assets

| Asset | Source | Runtime use | License / boundary |
|---|---|---|---|
| `assets/models/campus-shuttle.glb` | Approved original low-detail model generation | Optional visual for the college shuttle at the Namakkal bus stand; the game falls back to a procedural shuttle when loading fails | Original generated asset for this project; no GTA or third-party branded content |
| `public/fonts/ManusCC0-*.ttf` | Starter-provided Manus CC0 font package | Title, HUD and settings typography | CC0 package; see `public/fonts/ManusCC0-LICENSE.txt` |
| Procedural student avatar | `src/game/player.ts` | Male/female-readable capsule avatar with school-color accent | Original code-generated geometry |
| Procedural campus and city props | `src/game/world.ts` | Buildings, roads, lamps, trees, hill, bus stand, sports ground, traffic and NPCs | Original code-generated geometry and materials |
| Canvas signage | `src/game/world.ts` | Campus/landmark signboards | Runtime-generated text textures; no copied signage or photography |

## Visual boundary

The scene is stylized and non-photoreal. It uses public place categories—classroom block, labs, library, canteen, hostel, sports ground, bus stand, shops and hill-temple view—but does not copy an official campus map, logo, photograph or private data. Exact building positions, route paths, traffic, schedules and labels are fictionalized gameplay content.

## Adding higher-fidelity art

New gameplay assets should be added through the managed game asset workflow, registered in `assets.lock.json`, copied to the project runtime path only when required, and referenced through `src/engine/assets.ts`. Keep a lightweight procedural fallback for preview boot reliability. Any imported asset must have an explicit compatible license and should not contain copyrighted GTA material or unlicensed institutional marks.
