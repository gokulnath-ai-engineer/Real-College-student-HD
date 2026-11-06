import './styles/main.css'
import './styles/touch-addition.css'
import { Assets } from './engine/assets'
import { Audio } from './engine/audio'
import { I18n, resolveLocale } from './engine/i18n'
import { Input } from './engine/input'
import { GameLoop } from './engine/loop'
import { SAVE_KEY, SaveStore, type SaveData } from './engine/save'
import type { Game } from './game/game'
import { TouchControls } from './ui/touch'
import { Ui } from './ui/ui'

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#game')!
  const firstRun = safeGet(SAVE_KEY) === null
  const save = new SaveStore()
  const i18n = new I18n(resolveLocale(save.data.locale, navigator.languages))
  const input = new Input(canvas)
  const audio = new Audio()
  const assets = new Assets()
  let game: Game | undefined
  let lockLostAt = 0

  const applySettings = (data: SaveData) => {
    input.sensitivity = data.sensitivity
    input.invertY = data.invertY
    audio.setVolumes(data.musicVolume, data.sfxVolume, data.muted)
    if (game) game.reducedMotion = data.reducedMotion
  }

  const startRun = (tutorial: boolean) => {
    if (!game) return
    audio.unlock(); audio.startMusic(); game.configureProfile(save.data); game.start(tutorial); ui.show('hud'); loop.resetAccumulator(); input.lockPointer()
  }
  const pause = () => { if (game?.mode !== 'playing') return; game.pause(); ui.show('pause'); input.unlockPointer() }
  const resume = () => { if (game?.mode !== 'paused') return; game.resume(); ui.show('hud'); loop.resetAccumulator(); input.lockPointer() }

  const ui = new Ui(i18n, save, audio, input, {
    play: () => startRun(!save.data.tutorialDone),
    restart: () => startRun(false),
    resume,
    quit: () => { game?.toTitle(); ui.show('title'); input.unlockPointer() },
    settings: patch => { save.update(patch); applySettings(save.data); ui.refreshSettings() },
  })
  ui.show('boot'); applySettings(save.data)

  let loaded = 0
  const track = <T>(promise: Promise<T>): Promise<T> => promise.then(value => { loaded += 1; ui.setBootProgress(0.1 + (loaded / 5) * 0.9); return value })
  ui.setBootProgress(0.1)
  const [{ Game }, { Renderer, suggestQuality }, physics, shuttle] = await Promise.all([
    track(import('./game/game')),
    track(import('./engine/renderer')),
    track(import('./engine/physics')),
    track(assets.gltf('/assets/models/campus-shuttle.glb').catch(() => null)),
    track(document.fonts.ready),
  ])
  await physics.initPhysics()
  if (firstRun) { save.update({ quality: suggestQuality() }); ui.refreshSettings() }
  const renderer = new Renderer(canvas, save.data.quality)
  game = new Game(renderer, input, audio, {
    popup: (text, at, kind) => ui.popup(text, at, kind),
    hurt: () => ui.hurt(),
    hint: hint => ui.hint(hint),
    tutorialDone: () => save.update({ tutorialDone: true }),
    status: text => ui.status(text),
    persist: run => save.update({ clockMinutes: run.clockMinutes, day: run.day, weather: run.weather, attendance: run.attendance, money: run.money, reputation: run.reputation, missionIndex: run.missionIndex, inventory: run.inventory }),
    end: run => { input.unlockPointer(); window.setTimeout(() => ui.showResults(run), 600) },
  }, shuttle?.scene)
  game.configureProfile(save.data); game.reducedMotion = save.data.reducedMotion
  if (import.meta.env.DEV) { const [{ registerGameTuning }, { tuning }] = await Promise.all([import('../scripts/manus-tuning/adapter.js'), import('./game/tuning')]); await registerGameTuning(tuning) }
  const g = game
  const loop = new GameLoop({
    beforeFrame: frameSeconds => input.update(frameSeconds),
    step: dt => g.step(dt),
    render: (alpha, frameSeconds) => { if (input.consume('pause') && performance.now() - lockLostAt > 300) { if (g.mode === 'playing') pause(); else if (g.mode === 'paused' && ui.screen === 'pause') resume() } ui.frame(frameSeconds); loop.paused = g.mode === 'paused'; g.render(alpha, frameSeconds); if (g.mode === 'playing' || g.mode === 'ended') ui.updateHud(g.run, g.compass()) },
  })
  loop.start()
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && g.mode === 'playing' && input.method === 'keyboard') { lockLostAt = performance.now(); pause() } })
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
  window.addEventListener('game:pause', pause)
  canvas.addEventListener('click', () => { if (g.mode === 'playing') input.lockPointer() })
  new TouchControls(document.getElementById('ui')!, input, () => g.mode === 'playing')
  window.setTimeout(() => ui.show('title'), 350)
  ;(window as unknown as { __game: unknown }).__game = { game: g, ui, input, save }
}

function safeGet(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }

boot().catch(error => { console.error(error); const el = document.getElementById('ui'); if (el) el.innerHTML = `<div class="fatal">Failed to start: ${String((error as Error)?.message ?? error).replace(/[<>&]/g, '')}</div>` })
