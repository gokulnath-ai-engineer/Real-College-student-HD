import { spawnSync } from 'node:child_process'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Manus-hosted builds can restore managed assets. External builders such as Render
// use the committed public fallbacks and do not have Manus Storage credentials.
if (process.env.MANUS_API_URL && process.env.MANUS_API_KEY) {
  run(process.execPath, ['scripts/manus-game-assets/restore.mjs'])
}

run(process.execPath, ['scripts/manus-game-sharing/build.mjs'])
