import type { Audio } from '../engine/audio'
import type { I18n } from '../engine/i18n'
import type { Input } from '../engine/input'
import type { SaveData } from '../engine/save'
import type { Compass, Hint, RunState } from '../game/game'

export type Screen = 'boot' | 'title' | 'hud' | 'pause' | 'settings' | 'leaderboard' | 'results'
export type UiActions = {
  play(): void
  resume(): void
  restart(): void
  quit(): void
  settings(patch: Partial<SaveData>): void
}

export class Ui {
  screen: Screen = 'boot'
  private readonly root: HTMLElement
  private lastStatus = 'Walk to a route marker and press E to interact.'
  private lastRun?: RunState
  private mapOpen = false
  private phoneOpen = false
  private inventoryOpen = false
  private hintText = ''

  constructor(_i18n: I18n, private readonly save: { data: SaveData }, private readonly audio: Audio, private readonly input: Input, private readonly actions: UiActions) {
    this.root = document.getElementById('ui')!
    this.root.innerHTML = this.template()
    this.root.addEventListener('click', e => this.onClick(e))
    this.root.addEventListener('input', e => this.onInput(e))
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement | null)?.matches?.('input, textarea')) return
      if (e.code === 'Escape' && this.screen === 'settings') { e.preventDefault(); e.stopImmediatePropagation(); this.input.consume('pause'); this.show('pause'); return }
      if (e.code === 'KeyM') this.togglePanel('map')
      if (e.code === 'KeyI') this.togglePanel('inventory')
      if (e.code === 'KeyP') this.togglePanel('phone')
    })
    this.refreshSettings()
  }

  show(screen: Screen): void { this.screen = screen; this.root.dataset.screen = screen; for (const element of this.root.querySelectorAll<HTMLElement>('[data-screen]')) element.classList.toggle('is-active', element.dataset.screen === screen); if (screen === 'title') this.renderTitle(); if (screen === 'settings') this.refreshSettings() }
  push(screen: Screen): void { this.show(screen) }
  back(): void { this.show(this.lastRun ? 'hud' : 'title') }
  setBootProgress(progress: number): void { const bar = this.root.querySelector<HTMLElement>('.boot-progress i'); if (bar) bar.style.transform = `scaleX(${Math.max(0.04, Math.min(1, progress))})` }
  frame(_dt: number): void {
    const state = this as unknown as { input?: { method?: string; move?: { y: number }; consume?: (action: string) => boolean }; moveFocus?: () => void }
    if (state.input?.method === 'gamepad' && state.input.move && state.input.move.y < -0.5) state.moveFocus?.()
    if (state.input?.method === 'gamepad' && state.input.consume?.('confirm')) (document.activeElement as HTMLElement | null)?.click?.()
  }

  updateHud(run: RunState, compass: Compass | null): void {
    this.lastRun = run
    this.text('.student-name', run.studentName)
    this.text('.student-meta', `${run.gender} · ${run.lifeMode} · Semester ${run.semester}`)
    this.text('.hud-clock', `${formatTime(run.clockMinutes)} · Day ${run.day}`)
    this.text('.hud-weather', run.weather === 'monsoon' ? 'MONSOON' : run.weather.toUpperCase())
    this.text('.hud-money', `₹${run.money.toLocaleString('en-IN')}`)
    this.text('.hud-rep', `${run.reputation} REP`)
    this.text('.hud-attendance', `${run.attendance}%`)
    this.text('.hud-vehicle', run.vehicle)
    this.text('.mission-title', run.missionTitle)
    this.text('.mission-detail', run.missionDetail)
    this.text('.status-line', this.lastStatus)
    const attendance = this.root.querySelector<HTMLElement>('.attendance-fill'); if (attendance) attendance.style.width = `${run.attendance}%`
    const reputation = this.root.querySelector<HTMLElement>('.rep-fill'); if (reputation) reputation.style.width = `${run.reputation}%`
    const compassEl = this.root.querySelector<HTMLElement>('.compass-arrow'); if (compassEl && compass) compassEl.style.transform = `rotate(${compass.angle}rad)`
    const distance = this.root.querySelector<HTMLElement>('.compass-distance'); if (distance && compass) distance.textContent = `${Math.round(compass.distance)} m`
    const marker = this.root.querySelector<HTMLElement>('.mini-marker'); if (marker && compass) { marker.style.left = `${50 + Math.sin(compass.angle) * 32}%`; marker.style.top = `${50 + Math.cos(compass.angle) * 32}%` }
    this.renderInventory(run.inventory)
  }

  popup(text: string, at: { x: number; y: number }, kind: 'score' | 'hurt'): void { const el = document.createElement('div'); el.className = `popup ${kind}`; el.textContent = text; el.style.left = `${at.x}px`; el.style.top = `${at.y}px`; this.root.append(el); window.setTimeout(() => el.remove(), 1300) }
  hurt(): void { this.root.querySelector('.hurt-vignette')?.classList.add('flash'); window.setTimeout(() => this.root.querySelector('.hurt-vignette')?.classList.remove('flash'), 240) }
  hint(hint: Hint): void { this.hintText = hint === 'move' ? 'WASD move · Mouse look · Shift sprint' : hint === 'interact' ? 'Press E near a marker to interact' : hint === 'mission' ? 'Mission updated · Check the left rail' : ''; this.text('.hint-line', this.hintText) }
  status(text: string): void { this.lastStatus = text; this.text('.status-line', text) }
  showResults(run: RunState): void { this.lastRun = run; this.text('.result-title', 'Campus arc complete'); this.text('.result-copy', `You finished the first-year campus arc with ${run.reputation} reputation and ₹${run.money.toLocaleString('en-IN')}.`); this.show('results') }

  refreshSettings(): void {
    const d = this.save.data
    const music = this.root.querySelector<HTMLInputElement>('[name="musicVolume"]'); if (music) music.value = String(d.musicVolume)
    const sfx = this.root.querySelector<HTMLInputElement>('[name="sfxVolume"]'); if (sfx) sfx.value = String(d.sfxVolume)
    const sensitivity = this.root.querySelector<HTMLInputElement>('[name="sensitivity"]'); if (sensitivity) sensitivity.value = String(d.sensitivity)
    this.root.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach(button => { const key = button.dataset.toggle as keyof SaveData; button.setAttribute('aria-pressed', String(d[key] === true)); button.querySelector('span')!.textContent = d[key] === true ? 'ON' : 'OFF' })
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    this.audio.unlock(); this.audio.play('ui')
    const action = target.dataset.action
    if (action === 'play') { this.actions.play(); return }
    if (action === 'restart') { this.actions.restart(); return }
    if (action === 'resume') { this.actions.resume(); return }
    if (action === 'quit') { this.actions.quit(); return }
    if (action === 'settings') { this.show('settings'); return }
    if (action === 'back') { this.back(); return }
    if (action === 'pause') { window.dispatchEvent(new CustomEvent('game:pause')); return }
    if (action === 'map' || action === 'phone' || action === 'inventory') { this.togglePanel(action); return }
    if (action === 'gender') { this.actions.settings({ gender: target.dataset.value as SaveData['gender'] }); this.renderTitle(); return }
    if (action === 'lifeMode') { this.actions.settings({ lifeMode: target.dataset.value as SaveData['lifeMode'] }); this.renderTitle(); return }
    if (action === 'save') { this.actions.settings({}); this.status('Progress saved locally to this browser.'); return }
  }

  private onInput(event: Event): void { const target = event.target as HTMLInputElement; if (target.dataset.field === 'playerName') this.actions.settings({ playerName: target.value.slice(0, 18) }); if (target.name === 'musicVolume' || target.name === 'sfxVolume' || target.name === 'sensitivity') this.actions.settings({ [target.name]: Number(target.value) } as Partial<SaveData>) }

  private togglePanel(panel: 'map' | 'phone' | 'inventory'): void { this.mapOpen = panel === 'map' ? !this.mapOpen : false; this.phoneOpen = panel === 'phone' ? !this.phoneOpen : false; this.inventoryOpen = panel === 'inventory' ? !this.inventoryOpen : false; this.root.querySelector('[data-panel="map"]')?.classList.toggle('is-open', this.mapOpen); this.root.querySelector('[data-panel="phone"]')?.classList.toggle('is-open', this.phoneOpen); this.root.querySelector('[data-panel="inventory"]')?.classList.toggle('is-open', this.inventoryOpen); }

  private renderTitle(): void { this.text('.profile-name', this.save.data.playerName); this.text('.profile-gender', this.save.data.gender); this.text('.profile-mode', this.save.data.lifeMode); this.root.querySelectorAll('[data-value]').forEach(el => el.classList.toggle('selected', (el as HTMLElement).dataset.value === this.save.data.gender || (el as HTMLElement).dataset.value === this.save.data.lifeMode)) }
  private renderInventory(items: SaveData['inventory']): void { const list = this.root.querySelector<HTMLElement>('.inventory-list'); if (!list) return; list.innerHTML = items.map(item => `<li><span>${escapeHtml(item.label)}</span><b>x${item.qty}</b></li>`).join('') }
  private text(selector: string, value: string): void { const el = this.root.querySelector<HTMLElement>(selector); if (el) el.textContent = value }
  private template(): string { return `
    <section class="screen boot" data-screen="boot"><div class="brand-mark">RC<span>•</span></div><h1>REAL COLLEGE<br><em>STUDENT HD</em></h1><p>Namakkal · Tamil Nadu · Campus life, on your terms</p><div class="boot-progress"><i></i></div><small>Loading campus systems</small></section>
    <section class="screen title" data-screen="title"><div class="title-copy"><div class="eyebrow">CMSCE // NAMAKKAL DISTRICT</div><h1>Real College<br><em>Student HD</em></h1><p class="tagline">Show up. Skill up. Move forward.</p><p class="disclaimer">Original, stylized campus-life game. Public-source facts are separated from fictionalized gameplay.</p><button class="primary" data-action="play">START YOUR DAY <span>↗</span></button><button class="quiet" data-action="settings">Settings</button></div><div class="profile-card"><div class="section-label">STUDENT PROFILE</div><label>Name<input data-field="playerName" maxlength="18" value="${escapeHtml(this.save.data.playerName)}"></label><div class="section-label">IDENTITY</div><div class="choice-row"><button data-action="gender" data-value="Male">Male</button><button data-action="gender" data-value="Female">Female</button></div><div class="section-label">LIFE MODE</div><div class="choice-row"><button data-action="lifeMode" data-value="Hostel">Hostel</button><button data-action="lifeMode" data-value="Day Scholar">Day Scholar</button></div><div class="profile-summary"><b class="profile-name">${escapeHtml(this.save.data.playerName)}</b><span class="profile-gender">${this.save.data.gender}</span><span class="profile-mode">${this.save.data.lifeMode}</span></div></div><div class="title-stamp">01<br><small>FIRST YEAR<br>SEM 01</small></div></section>
    <section class="screen hud" data-screen="hud"><div class="topbar"><div><div class="hud-kicker">CMSCE / ERANAPURAM</div><strong class="student-name">Arun</strong><span class="student-meta">Male · Day Scholar · Semester 1</span></div><div class="top-stats"><span class="hud-money">₹850</span><span class="hud-rep">12 REP</span><span class="hud-clock">08:20 · Day 1</span><span class="hud-weather">CLEAR</span></div></div><aside class="mission-rail"><div class="rail-kicker">ACTIVE OBJECTIVE</div><h2 class="mission-title">Morning attendance</h2><p class="mission-detail">Reach the Classroom Block and check in before the lecture starts.</p><div class="progress-label"><span>ATTENDANCE</span><b class="hud-attendance">78%</b></div><div class="progress"><i class="attendance-fill"></i></div><div class="progress-label"><span>REPUTATION</span><b>100</b></div><div class="progress"><i class="rep-fill"></i></div><div class="rail-actions"><button data-action="map">M Map</button><button data-action="phone">P Phone</button><button data-action="inventory">I Bag</button></div></aside><div class="minimap"><div class="mini-grid"></div><span class="mini-label">CAMPUS / CITY EDGE</span><i class="mini-player"></i><i class="mini-marker"></i><div class="compass-arrow">▲</div><span class="compass-distance">0 m</span></div><div class="location-chip"><span class="pulse-dot"></span><b>CMS College of Engineering</b><span class="hud-vehicle">On Foot</span></div><div class="hint-line">WASD move · Mouse look · Shift sprint</div><div class="status-line">Walk to a route marker and press E to interact.</div><div class="quickbar"><button data-action="pause">Esc <span>Pause</span></button><span class="keycap">E</span><span>Interact</span></div><div class="hurt-vignette"></div><div class="panel" data-panel="map"><div class="panel-head"><span>FIELD MAP</span><button data-action="map">×</button></div><div class="map-large"><div class="map-road r1"></div><div class="map-road r2"></div><div class="map-campus">CMSCE CAMPUS</div><span class="map-pin p1">CLASSROOMS</span><span class="map-pin p2">LIBRARY</span><span class="map-pin p3">LABS</span><span class="map-pin p4">NAMAKKAL</span></div><p>Teal markers are public-place categories. Exact layout, traffic and schedules are fictionalized for gameplay.</p></div><div class="panel phone-panel" data-panel="phone"><div class="panel-head"><span>STUDENT PHONE</span><button data-action="phone">×</button></div><div class="phone-time">08:20</div><div class="phone-apps"><button>Timetable</button><button>Campus Map</button><button>Clubs</button><button>Messages</button></div><p>Today's nudge: attendance is a long game. Keep it above the threshold.</p></div><div class="panel inventory-panel" data-panel="inventory"><div class="panel-head"><span>INVENTORY</span><button data-action="inventory">×</button></div><ul class="inventory-list"></ul><button class="quiet" data-action="save">Save progress</button></div></section>
    <section class="screen pause" data-screen="pause"><div class="pause-card"><div class="eyebrow">DAY ${this.save.data.day} / SEM ${this.save.data.semester}</div><h2>PAUSED</h2><button class="primary" data-action="resume">Resume</button><button data-action="settings">Settings</button><button data-action="quit">Quit to title</button></div></section>
    <section class="screen settings" data-screen="settings"><div class="settings-card"><div class="panel-head"><span>SETTINGS</span><button data-action="back">×</button></div><label>Music<input type="range" name="musicVolume" min="0" max="1" step="0.05"></label><label>Effects<input type="range" name="sfxVolume" min="0" max="1" step="0.05"></label><label>Look sensitivity<input type="range" name="sensitivity" min="0.2" max="3" step="0.1"></label><button class="quiet" data-action="back">Back</button></div></section>
    <section class="screen results" data-screen="results"><div class="result-card"><div class="eyebrow">STORY ARC // COMPLETE</div><h2 class="result-title">Campus arc complete</h2><p class="result-copy"></p><button class="primary" data-action="restart">Continue exploring</button><button data-action="quit">Return to title</button></div></section><div class="popup-layer"></div><div class="touch"><div class="touch-stick"><i></i></div><div class="touch-buttons"><button data-touch="jump">JUMP</button><button data-touch="dash">RUN</button></div></div>
  ` }
}

function formatTime(minutes: number): string { const h = Math.floor(minutes / 60) % 24; const m = Math.floor(minutes % 60).toString().padStart(2, '0'); return `${String(h).padStart(2, '0')}:${m}` }
function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char)) }
