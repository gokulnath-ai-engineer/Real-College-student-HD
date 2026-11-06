import * as THREE from 'three'
import { RAPIER, type Physics } from '../engine/physics'

export type MovingPlatform = { mesh: THREE.Mesh; body: RAPIER.RigidBody; from: THREE.Vector3; to: THREE.Vector3; period: number; phase: number; delta: THREE.Vector3; half: THREE.Vector3 }
export type DroneRoute = { center: THREE.Vector3; radius: number; phase: number; dir: 1 | -1 }
export const ISLANDS = [
  { x: 0, z: 0, top: 0, r: 7, cores: 2 }, { x: 15, z: 3, top: 1.5, r: 4, cores: 2 }, { x: 24, z: -8, top: 3.2, r: 3.5, cores: 2 },
  { x: 14, z: -19, top: 4.8, r: 4.5, cores: 2 }, { x: 0, z: -27, top: 6.5, r: 5, cores: 2 }, { x: -15, z: -16, top: 4.5, r: 4, cores: 2 },
  { x: -23, z: 1, top: 2.8, r: 3.5, cores: 2 }, { x: -11, z: 17, top: 1.2, r: 4.5, cores: 2 }, { x: 7, z: 17, top: 2.5, r: 3.5, cores: 2 }, { x: 0, z: -12, top: 10.5, r: 3, cores: 3 },
]
export function rng(seed: number): () => number { let value = seed >>> 0; return () => { value = (value + 0x6d2b79f5) >>> 0; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
export function planStones(a: typeof ISLANDS[number], b: typeof ISLANDS[number]): { x: number; z: number; top: number }[] { const dx = b.x - a.x; const dz = b.z - a.z; const distance = Math.hypot(dx, dz); const gap = distance - a.r - b.r; const dy = b.top - a.top; const out: { x: number; z: number; top: number }[] = []; let n = 0; while ((gap - n * 1.8) / (n + 1) > 2.3 || Math.abs(dy) / (n + 1) >= 1.05) n += 1; const between = (gap - n * 1.8) / (n + 1); for (let i = 1; i <= n; i += 1) { const along = a.r + between * i + 1.8 * (i - 0.5); out.push({ x: a.x + (dx / distance) * along, z: a.z + (dz / distance) * along, top: a.top + (dy * i) / (n + 1) }) } return out }
export type Location = { id: string; label: string; subtitle: string; position: THREE.Vector3; color: string; kind: 'campus' | 'city' | 'activity' }
type Npc = { root: THREE.Group; route: THREE.Vector3[]; routeIndex: number; speed: number; role: 'Student' | 'Faculty'; phase: number }
type Traffic = { root: THREE.Group; route: THREE.Vector3[]; t: number; speed: number; color: string }

const COLORS = {
  ink: '#081522', road: '#233340', roadLine: '#e8bd55', campus: '#4b9a82', lawn: '#174d4a', concrete: '#b9c8c1', teal: '#48d9c1', amber: '#ffc857', coral: '#f4866f', cream: '#f4efe2', blue: '#2f7fa0', purple: '#7667c8', red: '#d76561', hill: '#475169', rain: '#88c7ff', sun: '#ffd59d', overcast: '#aab9c4', night: '#101d36', white: '#ffffff', glass: '#6fbed1', leaf: '#2d8f66', trunk: '#76523a', navy: '#17233a', yellow: '#edc75c',
}

export const LOCATIONS: Location[] = [
  { id: 'gate', label: 'Main Gate', subtitle: 'CMSCE Nagar · Eranapuram', position: new THREE.Vector3(0, 0, 22), color: COLORS.teal, kind: 'campus' },
  { id: 'classrooms', label: 'Classroom Block', subtitle: 'Attend your next lecture', position: new THREE.Vector3(-16, 0, 4), color: COLORS.blue, kind: 'campus' },
  { id: 'labs', label: 'Engineering Labs', subtitle: 'CSE · ECE · EEE labs', position: new THREE.Vector3(16, 0, 4), color: COLORS.purple, kind: 'campus' },
  { id: 'library', label: 'Central Library', subtitle: 'Quiet study · project desk', position: new THREE.Vector3(-18, 0, -12), color: COLORS.amber, kind: 'campus' },
  { id: 'canteen', label: 'Student Canteen', subtitle: 'Meals and campus chatter', position: new THREE.Vector3(17, 0, -12), color: COLORS.coral, kind: 'activity' },
  { id: 'hostel', label: 'Hostel Quad', subtitle: 'Residential life', position: new THREE.Vector3(-3, 0, -25), color: COLORS.teal, kind: 'campus' },
  { id: 'sports', label: 'Sports Ground', subtitle: 'Cricket · football · badminton', position: new THREE.Vector3(30, 0, -23), color: COLORS.leaf, kind: 'activity' },
  { id: 'placement', label: 'Placement Cell', subtitle: 'Training and interview prep', position: new THREE.Vector3(0, 0, -8), color: COLORS.yellow, kind: 'activity' },
  { id: 'busstand', label: 'Namakkal Bus Stand', subtitle: 'City transport hub', position: new THREE.Vector3(-2, 0, 47), color: COLORS.coral, kind: 'city' },
  { id: 'shops', label: 'Eranapuram Shops', subtitle: 'Stationery · snacks · recharge', position: new THREE.Vector3(25, 0, 47), color: COLORS.amber, kind: 'city' },
  { id: 'temple', label: 'Hill Temple View', subtitle: 'A respectful landmark vista', position: new THREE.Vector3(-28, 0, 49), color: COLORS.purple, kind: 'city' },
]

export class World {
  readonly scene = new THREE.Scene()
  readonly sun: THREE.DirectionalLight
  readonly spawn = new THREE.Vector3(0, 1.15, 20)
  readonly movers: MovingPlatform[] = []
  readonly locations = LOCATIONS
  private readonly npcs: Npc[] = []
  private readonly traffic: Traffic[] = []
  private readonly clouds: THREE.Object3D[] = []
  private rain!: THREE.Points
  private rainPositions!: Float32Array
  private weather: 'clear' | 'monsoon' | 'overcast' = 'clear'
  private readonly shuttle?: THREE.Object3D

  constructor(private readonly physics: Physics, shadowMapSize: number, shuttleModel?: THREE.Object3D) {
    this.shuttle = shuttleModel
    this.scene.background = new THREE.Color(COLORS.night)
    this.scene.fog = new THREE.Fog(new THREE.Color(COLORS.night), 70, 170)
    this.scene.add(new THREE.HemisphereLight('#b4d8e6', '#1a2738', 1.25))
    this.sun = new THREE.DirectionalLight(COLORS.sun, 1.8)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    this.sun.shadow.camera.left = -80; this.sun.shadow.camera.right = 80; this.sun.shadow.camera.top = 80; this.sun.shadow.camera.bottom = -80; this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 170
    this.sun.shadow.bias = -0.0002; this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target)
    this.addGround()
    this.addRoads()
    this.addCampus()
    this.addCityEdge()
    this.addNature()
    this.addNpcs()
    this.addTraffic()
    this.addWeather()
  }

  update(dt: number, focus: THREE.Vector3, clockMinutes: number): void {
    const dayAngle = ((clockMinutes - 360) / 900) * Math.PI
    const daylight = THREE.MathUtils.clamp(Math.sin(dayAngle) * 0.75 + 0.2, 0.08, 1)
    this.sun.position.set(focus.x + 38 * Math.cos(dayAngle), focus.y + 46 * daylight, focus.z + 25)
    this.sun.target.position.copy(focus)
    this.sun.intensity = this.weather === 'overcast' ? daylight * 1.05 : daylight * 1.8
    for (const cloud of this.clouds) { cloud.position.x += dt * 0.35; if (cloud.position.x > 120) cloud.position.x = -120 }
    this.stepNpcs(dt, clockMinutes)
    this.stepTraffic(dt)
    this.updateRain(dt)
  }

  setWeather(weather: 'clear' | 'monsoon' | 'overcast'): void {
    this.weather = weather
    const bg = weather === 'monsoon' ? '#2b4666' : weather === 'overcast' ? '#617789' : '#101d36'
    this.scene.background = new THREE.Color(bg)
    this.scene.fog = new THREE.Fog(new THREE.Color(bg), weather === 'monsoon' ? 55 : 75, 170)
    this.rain.visible = weather === 'monsoon'
  }

  stepMovers(_elapsed: number): void { /* Kept for the player contract; campus has no moving platforms. */ }

  interactionAt(position: THREE.Vector3): Location | null {
    let found: Location | null = null
    let distance = 5.2
    for (const location of this.locations) {
      const d = position.distanceTo(location.position)
      if (d < distance) { found = location; distance = d }
    }
    return found
  }

  nearestLocation(position: THREE.Vector3): Location | null {
    let found: Location | null = null; let distance = Infinity
    for (const location of this.locations) { const d = position.distanceToSquared(location.position); if (d < distance) { distance = d; found = location } }
    return found
  }

  missionTarget(index: number): THREE.Vector3 {
    const ids = ['classrooms', 'library', 'labs', 'placement', 'sports']
    return (this.locations.find(location => location.id === ids[Math.min(index, 4)]) ?? this.locations[0]).position
  }

  vehicleAt(position: THREE.Vector3): 'Bike' | 'Car' | 'College Bus' | null {
    const vehicles = [
      { kind: 'Bike' as const, pos: new THREE.Vector3(8, 0, 20), radius: 3 },
      { kind: 'Car' as const, pos: new THREE.Vector3(-8, 0, 20), radius: 3 },
      { kind: 'College Bus' as const, pos: new THREE.Vector3(3, 0, 47), radius: 4 },
    ]
    const match = vehicles.find(vehicle => position.distanceTo(vehicle.pos) < vehicle.radius)
    return match?.kind ?? null
  }

  private addGround(): void {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(160, 0.3, 140), mat(COLORS.lawn))
    ground.position.y = -0.18; ground.receiveShadow = true; this.scene.add(ground)
    this.physics.addStaticBox(new THREE.Vector3(0, -0.18, 0), new THREE.Vector3(160, 0.3, 140))
  }

  private addRoads(): void {
    const roads = [
      { x: 0, z: 36, w: 7, h: 88 }, { x: 0, z: -2, w: 7, h: 70 }, { x: 0, z: -11, w: 64, h: 7 }, { x: 13, z: 25, w: 34, h: 6 }, { x: -14, z: 25, w: 28, h: 6 },
    ]
    for (const road of roads) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(road.w, 0.04, road.h), mat(COLORS.road)); mesh.position.set(road.x, 0.02, road.z); mesh.receiveShadow = true; this.scene.add(mesh)
      const lineCount = Math.floor(Math.max(road.w, road.h) / 8)
      for (let i = -lineCount; i <= lineCount; i += 1) {
        const horizontal = road.w > road.h
        const line = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 2.8 : 0.12, 0.045, horizontal ? 0.12 : 2.8), mat(COLORS.roadLine))
        line.position.set(horizontal ? road.x + i * 6 : road.x, 0.06, horizontal ? road.z : road.z + i * 6); this.scene.add(line)
      }
    }
  }

  private addCampus(): void {
    this.addArch(new THREE.Vector3(0, 0, 22))
    this.addBuilding('CLASSROOMS', new THREE.Vector3(-16, 0, 4), new THREE.Vector3(15, 5.5, 11), COLORS.blue)
    this.addBuilding('ENGINEERING LABS', new THREE.Vector3(16, 0, 4), new THREE.Vector3(15, 5.5, 11), COLORS.purple)
    this.addBuilding('CENTRAL LIBRARY', new THREE.Vector3(-18, 0, -12), new THREE.Vector3(15, 5.5, 10), COLORS.amber)
    this.addBuilding('STUDENT CANTEEN', new THREE.Vector3(17, 0, -12), new THREE.Vector3(14, 4.2, 9), COLORS.coral)
    this.addBuilding('HOSTEL QUAD', new THREE.Vector3(-3, 0, -25), new THREE.Vector3(23, 5.8, 9), COLORS.teal)
    this.addBuilding('PLACEMENT CELL', new THREE.Vector3(0, 0, -8), new THREE.Vector3(9, 3.8, 6), COLORS.yellow)
    this.addCourt(new THREE.Vector3(30, 0, -23))
    this.addSign('CMS COLLEGE OF ENGINEERING', new THREE.Vector3(0, 3.8, 22), COLORS.teal, 0.8)
    this.addSign('CMS NAGAR · ERANAPURAM', new THREE.Vector3(0, 2.1, 26), COLORS.cream, 0.45)
  }

  private addCityEdge(): void {
    this.addBusStand(new THREE.Vector3(-2, 0, 47))
    this.addBuilding('ERANAPURAM SHOPS', new THREE.Vector3(25, 0, 47), new THREE.Vector3(28, 4.4, 10), COLORS.amber)
    this.addHillTemple(new THREE.Vector3(-28, 0, 49))
    for (let x = -34; x <= 34; x += 8) this.addLamp(new THREE.Vector3(x, 0, 40))
  }

  private addBuilding(label: string, pos: THREE.Vector3, size: THREE.Vector3, accent: string): void {
    const base = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat(COLORS.concrete)); base.position.set(pos.x, size.y / 2, pos.z); base.castShadow = true; base.receiveShadow = true; this.scene.add(base)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(size.x + 0.5, 0.38, size.z + 0.5), mat(accent)); roof.position.set(pos.x, size.y + 0.19, pos.z); roof.castShadow = true; this.scene.add(roof)
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.06), mat(COLORS.ink)); door.position.set(pos.x, 1.2, pos.z - size.z / 2 - 0.04); this.scene.add(door)
    for (let x = -size.x / 2 + 2.2; x < size.x / 2; x += 3.2) for (const y of [1.7, 3.6]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 0.08), mat(COLORS.glass)); window.position.set(pos.x + x, y, pos.z - size.z / 2 - 0.05); window.castShadow = true; this.scene.add(window)
    }
    this.physics.addStaticBox(new THREE.Vector3(pos.x, size.y / 2, pos.z), size)
    this.addSign(label, new THREE.Vector3(pos.x, size.y + 0.75, pos.z - size.z / 2 - 0.15), accent, 0.5)
  }

  private addArch(pos: THREE.Vector3): void {
    const group = new THREE.Group(); group.position.copy(pos)
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.7, 1.1), mat(COLORS.teal)); const other = pillar.clone(); other.position.x = 10
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 1.2), mat(COLORS.teal)); beam.position.set(5, 4.2, 0)
    group.add(pillar, other, beam); this.scene.add(group); this.physics.addStaticBox(new THREE.Vector3(pos.x, 2.35, pos.z), new THREE.Vector3(1.1, 4.7, 1.1)); this.physics.addStaticBox(new THREE.Vector3(pos.x + 10, 2.35, pos.z), new THREE.Vector3(1.1, 4.7, 1.1))
  }

  private addCourt(pos: THREE.Vector3): void {
    const field = new THREE.Mesh(new THREE.BoxGeometry(28, 0.08, 18), mat('#3d936f')); field.position.copy(pos); this.scene.add(field)
    const stripe = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(24, 0.02, 14)), new THREE.LineBasicMaterial({ color: COLORS.cream })); stripe.position.set(pos.x, 0.06, pos.z); this.scene.add(stripe)
    for (const offset of [-6, 0, 6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), mat(COLORS.cream)); post.position.set(pos.x + offset, 1.1, pos.z); this.scene.add(post) }
    this.addSign('SPORTS GROUND', new THREE.Vector3(pos.x, 2.4, pos.z - 9.2), COLORS.leaf, 0.45)
  }

  private addBusStand(pos: THREE.Vector3): void {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 5), mat(COLORS.coral)); canopy.position.set(pos.x, 4.4, pos.z); this.scene.add(canopy)
    for (const x of [-9, 9]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), mat(COLORS.cream)); post.position.set(pos.x + x, 2.2, pos.z); this.scene.add(post) }
    this.addSign('NAMAKKAL BUS STAND', new THREE.Vector3(pos.x, 5.1, pos.z), COLORS.coral, 0.5)
    if (this.shuttle) { const bus = this.shuttle.clone(true); bus.scale.setScalar(1.8); bus.position.set(pos.x + 4, 1.2, pos.z + 2.8); bus.rotation.y = Math.PI; bus.traverse(obj => { obj.castShadow = true }); this.scene.add(bus) } else this.addVehicleMesh('College Bus', new THREE.Vector3(pos.x + 4, 1.1, pos.z + 2.8), COLORS.teal, 1.8)
    this.addVehicleMesh('Bike', new THREE.Vector3(8, 0.55, 20), COLORS.coral, 0.65)
    this.addVehicleMesh('Car', new THREE.Vector3(-8, 0.7, 20), COLORS.blue, 1.0)
  }

  private addVehicleMesh(kind: string, pos: THREE.Vector3, color: string, scale: number): void {
    const group = new THREE.Group(); group.position.copy(pos); group.scale.setScalar(scale)
    const body = new THREE.Mesh(new THREE.BoxGeometry(kind === 'Bike' ? 1.2 : 2.8, kind === 'Bus' || kind === 'College Bus' ? 1.8 : 0.8, kind === 'Bike' ? 2.1 : 4.8), mat(color)); body.castShadow = true; group.add(body)
    if (kind === 'Bike') { for (const z of [-0.72, 0.72]) { const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 14), mat(COLORS.ink)); wheel.rotation.x = Math.PI / 2; wheel.position.set(0, -0.32, z); group.add(wheel) } }
    else { for (const x of [-1.05, 1.05]) for (const z of [-1.45, 1.45]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12), mat(COLORS.ink)); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -0.42, z); group.add(wheel) } }
    this.scene.add(group)
  }

  private addHillTemple(pos: THREE.Vector3): void {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(11, 16, 7), mat(COLORS.hill)); hill.position.set(pos.x, 7, pos.z); hill.castShadow = true; this.scene.add(hill)
    const shrine = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.2, 4), mat(COLORS.coral)); shrine.position.set(pos.x, 16.5, pos.z); shrine.castShadow = true; this.scene.add(shrine)
    this.addSign('HILL TEMPLE VIEW', new THREE.Vector3(pos.x, 1.8, pos.z - 8), COLORS.purple, 0.42)
  }

  private addNature(): void {
    const random = seeded(88)
    for (let i = 0; i < 58; i += 1) { const x = -43 + random() * 86; const z = -34 + random() * 74; if (Math.abs(x) < 24 && Math.abs(z) < 17) continue; this.addTree(new THREE.Vector3(x, 0, z), 0.7 + random() * 0.8) }
    for (let i = 0; i < 18; i += 1) { const cloud = new THREE.Group(); for (let p = 0; p < 3; p += 1) { const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + random() * 1.8, 12, 8), new THREE.MeshBasicMaterial({ color: '#d5e5ec', transparent: true, opacity: 0.12 })); puff.position.set(p * 2 - 2, random(), random() * 1.2); puff.scale.y = 0.45; cloud.add(puff) } cloud.position.set(-90 + random() * 180, 20 + random() * 20, -60 + random() * 120); cloud.userData.speed = 0.2 + random() * 0.4; this.clouds.push(cloud); this.scene.add(cloud) }
  }

  private addTree(pos: THREE.Vector3, scale: number): void {
    const group = new THREE.Group(); group.position.copy(pos); group.scale.setScalar(scale)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.6, 8), mat(COLORS.trunk)); trunk.position.y = 0.8; trunk.castShadow = true
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), mat(COLORS.leaf)); crown.position.y = 2; crown.castShadow = true
    group.add(trunk, crown); this.scene.add(group)
  }

  private addLamp(pos: THREE.Vector3): void { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.5, 8), mat(COLORS.ink)); pole.position.set(pos.x, 1.75, pos.z); this.scene.add(pole); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: COLORS.amber, emissive: COLORS.amber, emissiveIntensity: 1.3 })); lamp.position.set(pos.x, 3.5, pos.z); this.scene.add(lamp) }

  private addSign(text: string, pos: THREE.Vector3, color: string, scale: number): void { const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128; const ctx = canvas.getContext('2d')!; ctx.fillStyle = COLORS.ink; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10); ctx.fillStyle = COLORS.cream; ctx.font = '700 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2); const texture = new THREE.CanvasTexture(canvas); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true })); sprite.position.copy(pos); sprite.scale.set(6 * scale, 1.5 * scale, 1); this.scene.add(sprite) }

  private addNpcs(): void {
    const studentRoutes = [[new THREE.Vector3(-10, 0, 18), new THREE.Vector3(-16, 0, 4), new THREE.Vector3(-18, 0, -12)], [new THREE.Vector3(10, 0, 18), new THREE.Vector3(16, 0, 4), new THREE.Vector3(17, 0, -12)], [new THREE.Vector3(-2, 0, 20), new THREE.Vector3(-3, 0, -25), new THREE.Vector3(0, 0, -8)], [new THREE.Vector3(27, 0, -20), new THREE.Vector3(17, 0, -12), new THREE.Vector3(16, 0, 4)]]
    studentRoutes.forEach((route, i) => this.addNpc('Student', route, i * 0.7))
    this.addNpc('Faculty', [new THREE.Vector3(0, 0, -8), new THREE.Vector3(-16, 0, 4), new THREE.Vector3(16, 0, 4)], 2.4)
  }

  private addNpc(role: Npc['role'], route: THREE.Vector3[], phase: number): void {
    const root = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.42, 5, 10), mat(role === 'Faculty' ? COLORS.amber : COLORS.teal)); body.position.y = 0.75; body.castShadow = true; const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), mat('#b97754')); head.position.y = 1.42; head.castShadow = true; root.add(body, head); root.position.copy(route[0]); this.scene.add(root); this.npcs.push({ root, route, routeIndex: 0, speed: role === 'Faculty' ? 1.1 : 1.5, role, phase })
  }

  private stepNpcs(dt: number, clockMinutes: number): void { for (const npc of this.npcs) { const active = (Math.floor(clockMinutes / 60) + Math.floor(npc.phase)) % 5 !== 3; const target = active ? npc.route[npc.routeIndex] : npc.route[(npc.routeIndex + 1) % npc.route.length]; const delta = target.clone().sub(npc.root.position); delta.y = 0; if (delta.length() < 0.5) npc.routeIndex = (npc.routeIndex + 1) % npc.route.length; else { delta.normalize(); npc.root.position.addScaledVector(delta, npc.speed * dt); npc.root.rotation.y = Math.atan2(delta.x, delta.z) } } }

  private addTraffic(): void {
    const routes = [[new THREE.Vector3(-30, 0.35, 36), new THREE.Vector3(30, 0.35, 36)], [new THREE.Vector3(30, 0.35, 42), new THREE.Vector3(-30, 0.35, 42)], [new THREE.Vector3(-26, 0.35, -11), new THREE.Vector3(26, 0.35, -11)]]
    routes.forEach((route, i) => { const root = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.2), mat([COLORS.coral, COLORS.blue, COLORS.yellow][i])); body.castShadow = true; root.add(body); root.position.copy(route[0]); this.scene.add(root); this.traffic.push({ root, route, t: i * 0.27, speed: 0.035 + i * 0.008, color: '' }) })
  }

  private stepTraffic(dt: number): void { for (const car of this.traffic) { car.t = (car.t + dt * car.speed) % 1; const a = car.route[0]; const b = car.route[1]; car.root.position.lerpVectors(a, b, car.t); car.root.lookAt(b.x, car.root.position.y, b.z) } }

  private addWeather(): void { const count = 520; this.rainPositions = new Float32Array(count * 3); for (let i = 0; i < count; i += 1) { this.rainPositions[i * 3] = -55 + Math.random() * 110; this.rainPositions[i * 3 + 1] = Math.random() * 35; this.rainPositions[i * 3 + 2] = -35 + Math.random() * 100 } const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3)); this.rain = new THREE.Points(geometry, new THREE.PointsMaterial({ color: COLORS.rain, size: 0.08, transparent: true, opacity: 0.7 })); this.rain.visible = false; this.scene.add(this.rain) }

  private updateRain(dt: number): void { if (!this.rain.visible) return; for (let i = 0; i < this.rainPositions.length; i += 3) { this.rainPositions[i + 1] -= dt * 16; if (this.rainPositions[i + 1] < 0) this.rainPositions[i + 1] = 28 + Math.random() * 8 } this.rain.geometry.attributes.position.needsUpdate = true }
}

function mat(color: string): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.04 }) }
function seeded(seed: number): () => number { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0xffffffff } }
