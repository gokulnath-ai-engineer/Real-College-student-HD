export const DEFAULT_CONFIG = {
  run: { seconds: 150, lives: 3, invulnerable: 1.6, killY: -18 },
  score: { core: 100, comboWindow: 3.5, comboMax: 5, timeBonus: 25, lifeBonus: 500 },
  player: {
    radius: 0.42, halfHeight: 0.5, walkSpeed: 7, sprintSpeed: 11, acceleration: 60, airControl: 0.45, jumpSpeed: 10.5, gravity: -30, lowJumpGravity: -58, maxFall: -40, coyoteTime: 0.12, jumpBuffer: 0.14, dashSpeed: 22, dashTime: 0.16, dashCooldown: 0.9, turnSpeed: 14,
  },
  camera: { distance: 6.4, height: 2.4, minPitch: -0.35, maxPitch: 1.1, follow: 10, fov: 62 },
  drones: { speed: 3.2, radius: 0.7, rageSpeed: 5, rageAt: 45 },
} as const

type MutableConfig<T> = { -readonly [K in keyof T]: T[K] extends number ? number : T[K] extends object ? MutableConfig<T[K]> : T[K] }
export const CONFIG: MutableConfig<typeof DEFAULT_CONFIG> = structuredClone(DEFAULT_CONFIG)
