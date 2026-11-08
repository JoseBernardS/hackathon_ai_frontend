export interface ForumPost {
  id: string
  author: string
  body: string
  createdAt: string
  score: number
  /** null for a top-level post, otherwise the post it answers. */
  parentId: string | null
  mine?: boolean
}

const NAMES = [
  'Marisol Reyes', 'Dwayne Clarke', 'Ana Beltran', 'Tomas Okafor',
  'Priya Nair', 'Luis Ferrer', 'Keisha Monroe', 'Oscar Pena',
]

const OPENERS = [
  'Still like this as of this morning.',
  'Called 311 about it last week, got a reference number.',
  'Second time this year on the same block.',
  'Got worse after the rain on Tuesday.',
  'My kid walks past here on the way to school.',
  'There is a crew nearby but they have not touched this one.',
]

const REPLIES = [
  'Same here, adding a photo from today.',
  'They patched the one a block over, so it is on their list.',
  'Confirmed, walked past an hour ago.',
  'Reference number helps, thanks.',
]

function makeRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Deterministic thread per report, so the demo is stable across reloads. */
export function seedForum(reportId: string): ForumPost[] {
  const seed = [...reportId].reduce((a, c) => a + c.charCodeAt(0), 0)
  const rand = makeRandom(seed * 7919)
  const rootCount = 1 + Math.floor(rand() * 3)
  const out: ForumPost[] = []

  for (let i = 0; i < rootCount; i++) {
    const rootId = `${reportId}-p${i}`
    out.push({
      id: rootId,
      author: NAMES[Math.floor(rand() * NAMES.length)],
      body: OPENERS[Math.floor(rand() * OPENERS.length)],
      createdAt: new Date(Date.now() - Math.floor(rand() * 4320) * 60_000).toISOString(),
      score: Math.floor(rand() * 18),
      parentId: null,
    })

    if (rand() > 0.45) {
      out.push({
        id: `${rootId}-r`,
        author: NAMES[Math.floor(rand() * NAMES.length)],
        body: REPLIES[Math.floor(rand() * REPLIES.length)],
        createdAt: new Date(Date.now() - Math.floor(rand() * 1200) * 60_000).toISOString(),
        score: Math.floor(rand() * 6),
        parentId: rootId,
      })
    }
  }

  return out
}
