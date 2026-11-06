import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import type { Gender, LifeMode, Quality, SaveData } from '../engine/save'
import { FollowCamera } from './camera'
import { CONFIG } from './config'
import { Player, type PlayerEvent } from './player'
import { tuning } from './tuning'
import { World, type Location } from './world'

export type Mode = 'attract' | 'playing' | 'paused' | 'ended'
export type Hint = 'move' | 'look' | 'interact' | 'mission' | 'jump' | null
export type Compass = { angle: number; distance: number; rise: number }
export type Weather = 'clear' | 'monsoon' | 'overcast'
export type RunState = {
  phase: 'playing' | 'won'
  studentName: string
  gender: Gender
  lifeMode: LifeMode
  semester: number
  day: number
  clockMinutes: number
  weather: Weather
  attendance: number
  money: number
  reputation: number
  missionIndex: number
  missionTitle: string
  missionDetail: string
  vehicle: 'On Foot' | 'Bike' | 'Car' | 'College Bus'
  interaction: string
  location: string
  inventory: SaveData['inventory']
}

export type GameHooks = {
  popup(text: string, screen: { x: number; y: number }, kind: 'score' | 'hurt'): void
  hurt(): void
  hint(hint: Hint): void
  tutorialDone(): void
  end(run: RunState): void
  status?(text: string): void
  persist?(run: RunState): void
}

const MISSION = [
  { title: 'Morning attendance', detail: 'Reach the Classroom Block and check in before the lecture starts.', reward: 0, rep: 3 },
  { title: 'Project desk', detail: 'Take the project notebook to the Central Library submission desk.', reward: 250, rep: 5 },
  { title: 'Lab orientation', detail: 'Visit Engineering Labs and meet the faculty guide.', reward: 150, rep: 6 },
  { title: 'Placement prep', detail: 'Report to the Placement Cell for interview practice.', reward: 400, rep: 8 },
  { title: 'Campus life', detail: 'Drop by the Sports Ground and choose a club activity.', reward: 100, rep: 4 },
]

export class Game {
  mode: Mode = 'attract'
  run: RunState
  reducedMotion = false
  private readonly physics: Physics
  private readonly world: World
  private readonly player: Player
  private readonly cam: FollowCamera
  private simTime = 0
  private time = 0
  private tutorial: Hint = null
  private tutorialLook = 0
  private readonly down = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
  private lastInteraction = ''
  private persistClock = 0
  private profile: SaveData

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio, private readonly hooks: GameHooks, shuttleModel?: THREE.Object3D) {
    this.profile = { ...defaultProfile() }
    this.physics = new Physics(CONFIG.player.gravity)
    this.world = new World(this.physics, renderer.shadowMapSize, shuttleModel)
    this.player = new Player(this.physics, this.world.spawn, this.world.movers)
    this.cam = new FollowCamera(this.physics, this.player.collider)
    this.world.scene.add(this.player.root, this.player.shadowMesh)
    this.run = this.makeRun()
    this.cam.reset(this.world.spawn, 0.1)
  }

  get camera(): THREE.PerspectiveCamera { return this.cam.camera }
  get scene(): THREE.Scene { return this.world.scene }

  configureProfile(profile: SaveData): void {
    this.profile = { ...profile }
    this.run = this.makeRun()
  }

  start(tutorial: boolean): void {
    tuning.activate('run')
    this.run = this.makeRun()
    this.player.teleport(this.world.spawn)
    this.player.facing = 0
    this.cam.reset(this.world.spawn, 0.1)
    this.mode = 'playing'
    this.input.endFrame()
    this.input.takeLook()
    this.tutorial = tutorial ? 'move' : null
    this.tutorialLook = 0
    this.hooks.hint(this.tutorial)
    this.hooks.status?.('Your timetable is a map. Reach the Classroom Block to start the day.')
  }

  pause(): void { if (this.mode === 'playing') this.mode = 'paused' }
  resume(): void { if (this.mode === 'paused') { this.mode = 'playing'; this.input.endFrame(); this.input.takeLook() } }
  toTitle(): void { this.mode = 'attract'; this.hooks.hint(null) }

  setQuality(quality: Quality): void {
    this.renderer.applyQuality(quality)
    this.world.scene.traverse(obj => { const material = (obj as THREE.Mesh).material; for (const m of Array.isArray(material) ? material : material ? [material] : []) m.needsUpdate = true })
  }

  step(dt: number): void {
    const jumpPressed = this.input.consume('jump')
    const dashPressed = this.input.consume('dash')
    const interact = this.input.consume('interact')
    const playing = this.mode === 'playing'
    this.simTime += dt
    this.world.stepMovers(this.simTime)
    const events: PlayerEvent[] = []
    if (playing) {
      const vehicleBoost = this.run.vehicle === 'On Foot' ? 1 : 1.35
      this.player.step(dt * vehicleBoost, { moveX: this.input.move.x, moveY: this.input.move.y, sprint: this.input.held('sprint'), jumpPressed, jumpHeld: this.input.held('jump'), dashPressed }, this.cam.yaw, events)
    }
    this.physics.step(dt)
    if (!playing) return
    const position = this.player.position
    if (interact) this.handleInteraction(position)
    for (const event of events) { if (event.type === 'jump') this.audio.play('jump'); if (event.type === 'land') this.audio.play('land'); if (event.type === 'dash') this.audio.play('dash') }
    if (position.y < CONFIG.run.killY) this.player.teleport(this.player.safe)
    this.run.clockMinutes += dt * 6
    if (this.run.clockMinutes >= 24 * 60) { this.run.clockMinutes -= 24 * 60; this.run.day += 1 }
    const hour = Math.floor(this.run.clockMinutes / 60)
    const weather: Weather = hour % 7 === 4 ? 'monsoon' : hour % 5 === 2 ? 'overcast' : 'clear'
    if (weather !== this.run.weather) { this.run.weather = weather; this.world.setWeather(weather); this.hooks.status?.(weather === 'monsoon' ? 'Monsoon shower: take cover or keep moving.' : weather === 'overcast' ? 'Cloud cover over the campus.' : 'The campus is bright again.') }
    this.world.update(dt, position, this.run.clockMinutes)
    this.persistClock += dt
    if (this.persistClock > 8) { this.persistClock = 0; this.hooks.persist?.(this.run) }
    if (this.tutorial === 'move' && position.distanceTo(this.world.spawn) > 4) { this.tutorial = 'interact'; this.hooks.hint('interact') }
  }

  render(_alpha: number, frameSeconds: number): void {
    this.time += frameSeconds
    this.physics.sync(_alpha)
    const target = this.player.root.position
    if (this.mode === 'attract') {
      const t = this.time * 0.08
      this.cam.camera.position.set(Math.sin(t) * 40, 22, 32 + Math.cos(t) * 40)
      this.cam.camera.lookAt(0, 2, 4)
      this.world.update(frameSeconds, target, this.run.clockMinutes)
    } else {
      const look = this.mode === 'playing' ? this.input.takeLook() : { x: 0, y: 0 }
      if (this.mode === 'playing' && this.tutorial === 'look') {
        this.tutorialLook += Math.abs(look.x) + Math.abs(look.y)
        if (this.tutorialLook > 0.05) this.advanceTutorial('jump')
      }
      this.cam.update(target, look, frameSeconds, false, this.reducedMotion)
      this.player.animate(frameSeconds, this.time, false, this.groundBelow(target))
    }
    this.renderer.render(this.world.scene, this.cam.camera)
  }

  compass(): Compass | null {
    const target = this.world.missionTarget(this.run.missionIndex)
    const pos = this.player.position
    const toTarget = target.clone().sub(pos)
    const distance = toTarget.length()
    const angle = Math.atan2(-toTarget.x, -toTarget.z) - this.cam.yaw
    return { angle: Math.atan2(Math.sin(angle), Math.cos(angle)), distance, rise: toTarget.y }
  }

  mapLocations(): Location[] { return this.world.locations }

  private handleInteraction(position: THREE.Vector3): void {
    const vehicle = this.world.vehicleAt(position)
    if (vehicle) {
      this.run.vehicle = this.run.vehicle === 'On Foot' ? vehicle : 'On Foot'
      this.lastInteraction = this.run.vehicle === 'On Foot' ? 'You parked the vehicle.' : `You are now driving the ${vehicle.toLowerCase()}.`
      this.hooks.status?.(this.lastInteraction)
      this.audio.play('ui')
      return
    }
    const location = this.world.interactionAt(position)
    if (!location) { this.hooks.status?.('Nothing nearby. Walk toward a teal route marker.'); return }
    this.lastInteraction = `${location.label}: ${location.subtitle}`
    const targetIndex = this.run.missionIndex
    const target = this.world.missionTarget(targetIndex)
    if (location.position.distanceTo(target) < 5.5 && targetIndex < MISSION.length) {
      const mission = MISSION[targetIndex]
      this.run.missionIndex += 1
      this.run.attendance = Math.min(100, this.run.attendance + (targetIndex === 0 ? 4 : 1))
      this.run.money += mission.reward
      this.run.reputation = Math.min(100, this.run.reputation + mission.rep)
      if (targetIndex === 1) this.addInventory('project-submitted', 'Submitted Project', 1, 'document')
      if (targetIndex === 4) this.addInventory('club-pass', 'Club Activity Pass', 1, 'collectible')
      this.hooks.popup(mission.reward > 0 ? `+₹${mission.reward}` : `+${mission.rep} rep`, this.project(location.position), 'score')
      this.hooks.status?.(`${location.label} complete. ${targetIndex === MISSION.length - 1 ? 'You cleared the first campus arc.' : 'New objective unlocked.'}`)
      this.audio.play('pickup')
      if (this.tutorial === 'interact') { this.tutorial = 'mission'; this.hooks.hint('mission'); this.hooks.tutorialDone() }
      if (this.run.missionIndex >= MISSION.length) { this.run.phase = 'won'; this.mode = 'ended'; this.hooks.end(this.run) }
    } else {
      this.hooks.status?.(`${location.label}: ${location.subtitle}`)
      this.audio.play('ui')
    }
  }

  private addInventory(id: string, label: string, qty: number, kind: SaveData['inventory'][number]['kind']): void {
    const existing = this.run.inventory.find(item => item.id === id)
    if (existing) existing.qty += qty
    else this.run.inventory.push({ id, label, qty, kind })
  }

  private makeRun(): RunState {
    const mission = MISSION[Math.min(this.profile.missionIndex, MISSION.length - 1)]
    return { phase: 'playing', studentName: this.profile.playerName, gender: this.profile.gender, lifeMode: this.profile.lifeMode, semester: this.profile.semester, day: this.profile.day, clockMinutes: this.profile.clockMinutes, weather: this.profile.weather, attendance: this.profile.attendance, money: this.profile.money, reputation: this.profile.reputation, missionIndex: this.profile.missionIndex, missionTitle: mission.title, missionDetail: mission.detail, vehicle: 'On Foot', interaction: '', location: 'CMS College of Engineering', inventory: this.profile.inventory.map(item => ({ ...item })) }
  }

  private groundBelow(position: THREE.Vector3): number | null { this.down.origin = { x: position.x, y: position.y, z: position.z }; const hit = this.physics.world.castRay(this.down, 30, true, undefined, undefined, this.player.collider); return hit ? position.y - hit.timeOfImpact : null }
  private project(world: THREE.Vector3): { x: number; y: number } { const v = world.clone().project(this.cam.camera); const canvas = this.renderer.canvas; return { x: ((v.x + 1) / 2) * canvas.clientWidth, y: ((1 - v.y) / 2) * canvas.clientHeight } }
  private advanceTutorial(next: Hint): void { this.tutorial = next; this.tutorialLook = 0; this.hooks.hint(next) }
}

function defaultProfile(): SaveData { return { version: 2, locale: '', musicVolume: 0.7, sfxVolume: 0.8, muted: false, sensitivity: 1, invertY: false, quality: 'high', reducedMotion: false, tutorialDone: false, playerName: 'Arun', gender: 'Male', lifeMode: 'Day Scholar', semester: 1, attendance: 78, money: 850, reputation: 12, missionIndex: 0, day: 1, clockMinutes: 500, weather: 'clear', inventory: [{ id: 'id-card', label: 'CMSCE ID Card', qty: 1, kind: 'document' }], leaderboard: [] } }
