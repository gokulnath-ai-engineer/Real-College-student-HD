# Data schema

The current build is offline-first and stores a versioned JSON document in browser `localStorage` under `collegehd.save`. No server, account or database service is required to play. The schema is deliberately shaped so it can be migrated to a managed profile/leaderboard backend later without changing gameplay code.

## Local save document (`version: 2`)

```ts
type SaveData = {
  version: 2
  locale: '' | 'en' | 'zh-CN'
  musicVolume: number       // 0..1
  sfxVolume: number          // 0..1
  muted: boolean
  sensitivity: number       // 0.2..3
  invertY: boolean
  quality: 'low' | 'medium' | 'high'
  reducedMotion: boolean
  tutorialDone: boolean
  playerName: string
  gender: 'Male' | 'Female'
  lifeMode: 'Hostel' | 'Day Scholar'
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

type InventoryItem = {
  id: string
  label: string
  qty: number
  kind: 'tool' | 'document' | 'food' | 'collectible'
}

type ScoreEntry = {
  name: string
  score: number
  seconds: number
  at: number
}
```

## Future relational/managed model

If online accounts are enabled later, keep these conceptual tables/collections:

- `profiles`: account id, display name, gender, life mode, semester, graduation state and created/updated timestamps.
- `progression`: profile id, day, clock, attendance, money, reputation, mission state and current weather.
- `inventory_items`: profile id, item id, quantity, kind and updated timestamp.
- `activities`: stable activity id, public category (`class`, `assignment`, `exam`, `club`, `sport`, `placement`), fictionalized content payload and reward rules.
- `submissions`: profile id, activity id, status, score and submitted timestamp; never store private institutional records in the public content layer.
- `leaderboard_entries`: profile id, score, duration, eligibility flag and created timestamp. Reject or omit unranked/dev-tuned runs server-side.

## Migration and privacy rules

`parseSave()` rejects unknown versions and migrates version 1 values into version 2 defaults. Values are clamped or validated before use; inventory is bounded. The browser save contains only local gameplay choices and fictionalized progression. It must not be presented as official college attendance, placement or student data.
