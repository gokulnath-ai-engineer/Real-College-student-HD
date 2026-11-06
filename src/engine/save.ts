export type Locale = 'en' | 'zh-CN'
export type Quality = 'low' | 'medium' | 'high'
export type Gender = 'Male' | 'Female'
export type LifeMode = 'Hostel' | 'Day Scholar'

export type InventoryItem = { id: string; label: string; qty: number; kind: 'tool' | 'document' | 'food' | 'collectible' }
export type ScoreEntry = { name: string; score: number; seconds: number; at: number }

export type SaveData = {
  version: 2
  locale: Locale | ''
  musicVolume: number
  sfxVolume: number
  muted: boolean
  sensitivity: number
  invertY: boolean
  quality: Quality
  reducedMotion: boolean
  tutorialDone: boolean
  playerName: string
  gender: Gender
  lifeMode: LifeMode
  semester: number
  attendance: number
  money: number
  reputation: number
  missionIndex: number
  day: number
  clockMinutes: number
  weather: 'clear' | 'monsoon' | 'overcast'
  inventory: InventoryItem[]
  leaderboard: ScoreEntry[]
}

export const SAVE_KEY = 'collegehd.save'
export const LEADERBOARD_SIZE = 10

export function defaultSave(): SaveData {
  return {
    version: 2,
    locale: '',
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    sensitivity: 1,
    invertY: false,
    quality: 'high',
    reducedMotion: false,
    tutorialDone: false,
    playerName: 'Arun',
    gender: 'Male',
    lifeMode: 'Day Scholar',
    semester: 1,
    attendance: 78,
    money: 850,
    reputation: 12,
    missionIndex: 0,
    day: 1,
    clockMinutes: 8 * 60 + 20,
    weather: 'clear',
    inventory: [
      { id: 'id-card', label: 'CMSCE ID Card', qty: 1, kind: 'document' },
      { id: 'notebook', label: 'Project Notebook', qty: 1, kind: 'tool' },
    ],
    leaderboard: [],
  }
}

const clamp = (value: unknown, min: number, max: number, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

export function parseSave(raw: string | null): SaveData {
  const base = defaultSave()
  if (!raw) return base
  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    data = parsed as Record<string, unknown>
  } catch {
    return base
  }
  if (data.version !== 1 && data.version !== 2) return base
  const inventory = Array.isArray(data.inventory) ? data.inventory : base.inventory
  return {
    ...base,
    version: 2,
    locale: data.locale === 'en' || data.locale === 'zh-CN' ? data.locale : base.locale,
    musicVolume: clamp(data.musicVolume, 0, 1, base.musicVolume),
    sfxVolume: clamp(data.sfxVolume, 0, 1, base.sfxVolume),
    muted: data.muted === true,
    sensitivity: typeof data.sensitivity === 'number' && data.sensitivity >= 0.2 && data.sensitivity <= 3 ? data.sensitivity : base.sensitivity,
    invertY: data.invertY === true,
    quality: data.quality === 'low' || data.quality === 'medium' || data.quality === 'high' ? data.quality : base.quality,
    reducedMotion: data.reducedMotion === true,
    tutorialDone: data.tutorialDone === true,
    playerName: typeof data.playerName === 'string' && data.playerName.trim() ? data.playerName.trim().slice(0, 16) : base.playerName,
    gender: data.gender === 'Female' ? 'Female' : 'Male',
    lifeMode: data.lifeMode === 'Hostel' ? 'Hostel' : 'Day Scholar',
    semester: Math.round(clamp(data.semester, 1, 8, base.semester)),
    attendance: Math.round(clamp(data.attendance, 0, 100, base.attendance)),
    money: Math.round(clamp(data.money, 0, 999999, base.money)),
    reputation: Math.round(clamp(data.reputation, 0, 100, base.reputation)),
    missionIndex: Math.round(clamp(data.missionIndex, 0, 5, base.missionIndex)),
    day: Math.max(1, Math.round(clamp(data.day, 1, 999, base.day))),
    clockMinutes: clamp(data.clockMinutes, 0, 1439, base.clockMinutes),
    weather: data.weather === 'monsoon' || data.weather === 'overcast' ? data.weather : 'clear',
    inventory: inventory
      .filter((item): item is InventoryItem => !!item && typeof item === 'object' && typeof (item as InventoryItem).id === 'string' && typeof (item as InventoryItem).label === 'string')
      .map(item => ({ id: item.id.slice(0, 40), label: item.label.slice(0, 60), qty: Math.max(1, Math.floor(Number(item.qty) || 1)), kind: (item.kind === 'food' || item.kind === 'collectible' || item.kind === 'document' ? item.kind : 'tool') as InventoryItem['kind'] }))
      .slice(0, 32),
    leaderboard: Array.isArray(data.leaderboard) ? data.leaderboard.filter((entry): entry is ScoreEntry => !!entry && typeof entry === 'object' && typeof (entry as ScoreEntry).name === 'string' && Number.isFinite((entry as ScoreEntry).score)).map(entry => ({ name: entry.name.slice(0, 18), score: Math.max(0, Math.floor(entry.score)), seconds: Math.max(0, Math.floor(entry.seconds || 0)), at: entry.at || 0 })).slice(0, LEADERBOARD_SIZE) : base.leaderboard,
  }
}

export function insertScore(board: ScoreEntry[], entry: ScoreEntry): { board: ScoreEntry[]; rank: number } {
  const next = [...board, entry].sort((a, b) => b.score - a.score || a.seconds - b.seconds || a.at - b.at).slice(0, LEADERBOARD_SIZE)
  return { board: next, rank: next.indexOf(entry) }
}

export class SaveStore {
  data: SaveData

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
    let raw: string | null = null
    try { raw = this.storage?.getItem(SAVE_KEY) ?? null } catch { raw = null }
    this.data = parseSave(raw)
  }

  update(patch: Partial<SaveData>): void {
    this.data = { ...this.data, ...patch }
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data)) } catch { /* Keep the in-memory save alive. */ }
  }
}
