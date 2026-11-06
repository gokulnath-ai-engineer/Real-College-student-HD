import * as THREE from 'three'
import { RAPIER, type Physics } from '../engine/physics'
import { CONFIG } from './config'
import { tuning } from './tuning'
import type { MovingPlatform } from './world'

export type PlayerIntent = { moveX: number; moveY: number; sprint: boolean; jumpPressed: boolean; jumpHeld: boolean; dashPressed: boolean }
export type PlayerEvent = { type: 'jump' } | { type: 'land'; impact: number } | { type: 'dash' }

const P = CONFIG.player
const UP = new THREE.Vector3(0, 1, 0)

export class Player {
  readonly root = new THREE.Group()
  readonly body: RAPIER.RigidBody
  readonly collider: RAPIER.Collider
  readonly velocity = new THREE.Vector3()
  grounded = false
  facing = 0
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly model = new THREE.Group()
  private readonly eyes: THREE.Mesh
  private readonly shadow: THREE.Mesh
  private coyote = 0
  private jumpBuffer = 0
  private jumping = false
  private dashTime = 0
  private dashCooldown = 0
  private squash = 0
  private runCycle = 0
  private platform?: MovingPlatform
  readonly safe = new THREE.Vector3()
  private safeTimer = 0

  constructor(private readonly physics: Physics, spawn: THREE.Vector3, private readonly movers: MovingPlatform[]) {
    const world = physics.world
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(P.halfHeight, P.radius).setFriction(0), this.body)
    this.controller = world.createCharacterController(0.02)
    this.controller.enableAutostep(0.4, 0.25, false)
    this.controller.enableSnapToGround(0.35)
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50))
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(35))
    this.controller.setApplyImpulsesToDynamicBodies(true)
    this.safe.copy(spawn)
    this.root.position.copy(spawn)
    this.eyes = this.buildModel()
    this.model.rotation.order = 'YXZ'
    this.root.add(this.model)
    physics.bind(this.body, this.root)
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(P.radius * 1.45, 24), new THREE.MeshBasicMaterial({ color: '#081522', transparent: true, opacity: 0.3, depthWrite: false }))
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.renderOrder = 1
  }

  get shadowMesh(): THREE.Mesh { return this.shadow }
  get position(): THREE.Vector3 { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y, t.z) }
  get dashing(): boolean { return this.dashTime > 0 }

  step(dt: number, intent: PlayerIntent, cameraYaw: number, events: PlayerEvent[]): void {
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw))
    const right = new THREE.Vector3().crossVectors(forward, UP)
    const wish = new THREE.Vector3().addScaledVector(right, intent.moveX).addScaledVector(forward, intent.moveY)
    const wishLen = Math.min(1, wish.length())
    if (wishLen > 0.01) wish.normalize()
    this.coyote = this.grounded ? P.coyoteTime : Math.max(0, this.coyote - dt)
    this.jumpBuffer = intent.jumpPressed ? P.jumpBuffer : Math.max(0, this.jumpBuffer - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    const jumpReady = this.jumpBuffer > 0 && this.coyote > 0
    if (jumpReady) this.dashTime = 0
    if (intent.dashPressed && this.dashCooldown <= 0 && !jumpReady) {
      tuning.activate('dash')
      const dir = wishLen > 0.01 ? wish : new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))
      this.facing = Math.atan2(-dir.x, -dir.z)
      this.velocity.set(dir.x * P.dashSpeed, Math.max(this.velocity.y, 0), dir.z * P.dashSpeed)
      this.dashTime = P.dashTime
      this.dashCooldown = P.dashCooldown
      events.push({ type: 'dash' })
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt
      this.velocity.y = Math.max(this.velocity.y, 0)
    } else {
      const speed = (intent.sprint ? P.sprintSpeed : P.walkSpeed) * wishLen
      const target = wish.clone().multiplyScalar(speed)
      const horizontal = new THREE.Vector3(this.velocity.x, 0, this.velocity.z)
      horizontal.lerp(target, 1 - Math.exp(-(P.acceleration / 6) * (this.grounded ? 1 : P.airControl) * dt))
      this.velocity.x = horizontal.x
      this.velocity.z = horizontal.z
      if (jumpReady) {
        tuning.activate('jump')
        this.velocity.y = P.jumpSpeed
        this.jumping = true
        this.jumpBuffer = 0
        this.coyote = 0
        this.grounded = false
        this.squash = -0.35
        events.push({ type: 'jump' })
      }
      const rising = this.velocity.y > 0
      this.velocity.y = Math.max(P.maxFall, this.velocity.y + (rising && this.jumping && !intent.jumpHeld ? P.lowJumpGravity : P.gravity) * dt)
    }
    if (wishLen > 0.1 && this.dashTime <= 0) this.facing = dampAngle(this.facing, Math.atan2(-wish.x, -wish.z), P.turnSpeed, dt)
    const desired = this.velocity.clone().multiplyScalar(dt)
    if (this.platform) desired.add(this.platform.delta)
    this.controller.computeColliderMovement(this.collider, desired)
    const moved = this.controller.computedMovement()
    const wasGrounded = this.grounded
    this.grounded = this.controller.computedGrounded()
    if (this.velocity.y > 0 && moved.y < desired.y - 1e-3) this.velocity.y = 0
    if (this.grounded) {
      if (!wasGrounded && this.velocity.y < -6) events.push({ type: 'land', impact: Math.min(1, -this.velocity.y / 30) })
      if (this.velocity.y < 0) this.velocity.y = -1
      this.jumping = false
    }
    const cur = this.body.translation()
    const next = { x: cur.x + moved.x, y: cur.y + moved.y, z: cur.z + moved.z }
    this.body.setNextKinematicTranslation(next)
    this.platform = this.grounded ? this.findPlatform(next) : undefined
    if (this.grounded && !this.platform) {
      this.safeTimer += dt
      if (this.safeTimer > 0.4) this.safe.set(next.x, next.y + 0.2, next.z)
    } else this.safeTimer = 0
  }

  private findPlatform(pos: { x: number; y: number; z: number }): MovingPlatform | undefined {
    const feet = pos.y - P.halfHeight - P.radius
    return this.movers.find(m => { const c = m.body.translation(); const top = c.y + m.half.y; return Math.abs(feet - top) < 0.2 && Math.abs(pos.x - c.x) < m.half.x + P.radius * 0.6 && Math.abs(pos.z - c.z) < m.half.z + P.radius * 0.6 })
  }

  teleport(to: THREE.Vector3): void { this.body.setTranslation(to, true); this.body.setNextKinematicTranslation(to); this.velocity.set(0, 0, 0); this.platform = undefined; this.root.position.copy(to); this.physics.snap(this.body) }
  knockback(from: THREE.Vector3): void { const away = this.position.sub(from).setY(0); if (away.lengthSq() < 1e-4) away.set(1, 0, 0); away.normalize().multiplyScalar(5); this.velocity.set(away.x, 5, away.z); this.dashTime = 0; this.grounded = false; this.platform = undefined }

  animate(frameSeconds: number, time: number, invulnerable: boolean, ground: number | null): void {
    const speed = Math.hypot(this.velocity.x, this.velocity.z)
    this.model.rotation.y = this.facing
    this.squash = THREE.MathUtils.damp(this.squash, 0, 10, frameSeconds)
    const stretch = this.grounded ? 0 : THREE.MathUtils.clamp(this.velocity.y / 60, -0.12, 0.18)
    const s = 1 - this.squash + stretch
    this.model.scale.set(1 / Math.sqrt(Math.max(s, 0.5)), s, 1 / Math.sqrt(Math.max(s, 0.5)))
    if (this.grounded && speed > 0.5) this.runCycle += frameSeconds * speed * 1.6
    this.model.position.y = this.grounded ? Math.abs(Math.sin(this.runCycle)) * 0.06 * Math.min(1, speed / 6) : 0
    this.model.rotation.x = -Math.min(0.18, speed / 40) * (this.dashing ? 1.6 : 1)
    this.model.visible = !invulnerable || Math.floor(time * 16) % 2 === 0
    ;(this.eyes.material as THREE.MeshStandardMaterial).emissiveIntensity = this.dashing ? 1.5 : 0.35
    if (ground === null) this.shadow.visible = false
    else {
      const feet = this.root.position.y - P.halfHeight - P.radius
      const height = Math.max(0, feet - ground)
      this.shadow.visible = height < 14
      this.shadow.position.set(this.root.position.x, ground + 0.03, this.root.position.z)
      const k = THREE.MathUtils.clamp(1 - height / 14, 0.25, 1)
      this.shadow.scale.setScalar(k)
      ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 * k
    }
  }

  private buildModel(): THREE.Mesh {
    const skin = new THREE.MeshStandardMaterial({ color: '#b97754', roughness: 0.72 })
    const shirt = new THREE.MeshStandardMaterial({ color: '#e9f4f0', roughness: 0.56 })
    const teal = new THREE.MeshStandardMaterial({ color: '#2fb7a6', roughness: 0.5, metalness: 0.05 })
    const navy = new THREE.MeshStandardMaterial({ color: '#1c3044', roughness: 0.5 })
    const hair = new THREE.MeshStandardMaterial({ color: '#1b1922', roughness: 0.8 })
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#d6fff6', emissive: '#58d8c4', emissiveIntensity: 0.35 })
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.42, 6, 14), shirt); torso.position.y = -0.22
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.55, 0.12), teal); jacket.position.set(0, -0.26, 0.27)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), skin); head.position.y = 0.42
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hair); hairCap.position.set(0, 0.52, 0.01)
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6)
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.11, 0.42, -0.33)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.11, 0.42, -0.33)
    const legGeo = new THREE.CapsuleGeometry(0.13, 0.48, 4, 8)
    const legL = new THREE.Mesh(legGeo, navy); legL.position.set(-0.18, -0.78, 0)
    const legR = new THREE.Mesh(legGeo, navy); legR.position.set(0.18, -0.78, 0)
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.16), teal); bag.position.set(0.34, -0.18, 0.18); bag.rotation.z = -0.15
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: '#ffc857', emissive: '#7b4d0e', emissiveIntensity: 0.25 })); badge.position.set(-0.12, -0.12, -0.34)
    for (const mesh of [torso, jacket, head, hairCap, eyeL, eyeR, legL, legR, bag, badge]) { mesh.castShadow = true; this.model.add(mesh) }
    return eyeL
  }
}

function dampAngle(from: number, to: number, lambda: number, dt: number): number { let delta = (to - from) % (Math.PI * 2); if (delta > Math.PI) delta -= Math.PI * 2; if (delta < -Math.PI) delta += Math.PI * 2; return from + delta * (1 - Math.exp(-lambda * dt)) }
