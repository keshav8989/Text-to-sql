// Graph-based schema linking (Problem 1 — mid-sem deliverable).
// Stage 1: lexical/synonym/value matching gives each schema node a seed score.
// Stage 2: scores propagate over the schema graph (table↔column, FK edges).
// Stage 3: a Steiner-style BFS adds bridge tables so that selected tables stay joinable.
import { SCHEMA } from './db'

export type NodeScore = { id: string; kind: 'table' | 'column'; score: number; evidence: string[] }
export type LinkResult = {
  tokens: string[]
  nodes: NodeScore[]
  tables: string[]
  columns: string[]
  joinPaths: string[][]
  prunedSchema: string
  fullSchema: string
}

const STOP = new Set('the a an of in on for to and or is are was were what which who whom whose how many much list show give me all with by from that than at as be do does did have has each every their there its find get name names number'.split(' '))

const stem = (w: string) => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '').replace(/(ing|ed)$/, '')

export function tokenize(q: string) {
  return q.toLowerCase().replace(/[^a-z0-9\s.]/g, ' ').split(/\s+/).filter(Boolean)
}

function trigrams(s: string) {
  const p = `  ${s} `
  const g = new Set<string>()
  for (let i = 0; i < p.length - 2; i++) g.add(p.slice(i, i + 3))
  return g
}
function trigramSim(a: string, b: string) {
  const A = trigrams(a), B = trigrams(b)
  let inter = 0
  A.forEach((x) => B.has(x) && inter++)
  return inter / (A.size + B.size - inter)
}

/** Best match of a phrase against question n-grams. Returns [score, matched n-gram]. */
function matchPhrase(phrase: string, grams: string[]): [number, string] {
  const p = phrase.toLowerCase().replace(/_/g, ' ')
  const ps = p.split(' ').map(stem).join(' ')
  let best: [number, string] = [0, '']
  for (const g of grams) {
    const gs = g.split(' ').map(stem).join(' ')
    let s = 0
    if (gs === ps) s = 1
    else if (ps.length > 3 && ` ${gs} `.includes(` ${ps} `)) s = 0.7
    else {
      const t = trigramSim(gs, ps)
      if (t > 0.45) s = t * 0.8
    }
    if (s > best[0]) best = [s, g]
  }
  return best
}

type Edge = [string, string, number]
export function schemaGraph() {
  const nodes: { id: string; kind: 'table' | 'column' }[] = []
  const edges: Edge[] = []
  for (const t of SCHEMA) {
    nodes.push({ id: t.name, kind: 'table' })
    for (const c of t.columns) {
      const id = `${t.name}.${c.name}`
      nodes.push({ id, kind: 'column' })
      edges.push([t.name, id, 0.5])
      if (c.fk) edges.push([id, c.fk, 0.8])
    }
  }
  return { nodes, edges }
}

const fkTableEdges = () => {
  const adj: Record<string, string[]> = {}
  for (const t of SCHEMA) adj[t.name] ??= []
  for (const t of SCHEMA)
    for (const c of t.columns)
      if (c.fk) {
        const other = c.fk.split('.')[0]
        adj[t.name].push(other)
        adj[other].push(t.name)
      }
  return adj
}

function shortestPath(a: string, b: string, adj: Record<string, string[]>, prefer: string[] = []) {
  const prev: Record<string, string | null> = { [a]: null }
  const q = [a]
  while (q.length) {
    const x = q.shift()!
    if (x === b) break
    for (const y of [...adj[x]].sort((u, v) => +prefer.includes(v) - +prefer.includes(u))) if (!(y in prev)) { prev[y] = x; q.push(y) }
  }
  if (!(b in prev)) return []
  const path: string[] = []
  for (let x: string | null = b; x; x = prev[x]) path.unshift(x)
  return path
}

export function schemaDDL(tables: string[], columns?: Set<string>) {
  return SCHEMA.filter((t) => tables.includes(t.name))
    .map((t) => {
      const cols = t.columns
        .filter((c) => !columns || columns.has(`${t.name}.${c.name}`) || c.pk || c.fk)
        .map((c) => `  ${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.fk ? ` REFERENCES ${c.fk.replace('.', '(')})` : ''}`)
      return `CREATE TABLE ${t.name} (\n${cols.join(',\n')}\n);`
    })
    .join('\n')
}

export function linkSchema(question: string, values: Record<string, string[]>, threshold = 0.42): LinkResult {
  const raw = tokenize(question)
  const tokens = raw.filter((t) => !STOP.has(t))
  const grams: string[] = []
  for (let n = 1; n <= 3; n++)
    for (let i = 0; i + n <= raw.length; i++) {
      const g = raw.slice(i, i + n)
      if (n === 1 && STOP.has(g[0])) continue
      grams.push(g.join(' '))
    }

  const score: Record<string, NodeScore> = {}
  const bump = (id: string, kind: 'table' | 'column', s: number, why: string) => {
    score[id] ??= { id, kind, score: 0, evidence: [] }
    if (s > 0.05) score[id].evidence.push(why)
    score[id].score = Math.max(score[id].score, s)
  }

  // Stage 1 — seed scores
  for (const t of SCHEMA) {
    bump(t.name, 'table', 0, '')
    const [s1, g1] = matchPhrase(t.name, grams)
    if (s1) bump(t.name, 'table', s1, `name≈"${g1}"`)
    for (const syn of t.synonyms) {
      const [s, g] = matchPhrase(syn, grams)
      if (s) bump(t.name, 'table', s * 0.92, `synonym "${syn}"≈"${g}"`)
    }
    for (const c of t.columns) {
      const id = `${t.name}.${c.name}`
      bump(id, 'column', 0, '')
      if (!c.name.endsWith('_id')) {
        const [s, g] = matchPhrase(c.name, grams)
        if (s) bump(id, 'column', s, `name≈"${g}"`)
      }
      for (const syn of c.synonyms) {
        const [s, g] = matchPhrase(syn, grams)
        if (s) bump(id, 'column', s * 0.9, `synonym "${syn}"≈"${g}"`)
      }
      for (const v of values[id] ?? []) {
        const vl = v.toLowerCase()
        if (vl.length > 2 && question.toLowerCase().includes(vl)) bump(id, 'column', 0.95, `cell value "${v}"`)
      }
    }
  }

  // Stage 2 — propagation over graph edges (2 iterations of max-product message passing)
  const { edges } = schemaGraph()
  for (let it = 0; it < 2; it++) {
    const snap = Object.fromEntries(Object.values(score).map((n) => [n.id, n.score]))
    for (const [a, b, w] of edges) {
      const ka = score[a].kind, kb = score[b].kind
      // column → its table is strong evidence; table → column is weak (keeps columns precise)
      const wab = ka === 'column' && kb === 'table' ? 0.85 : ka === 'table' ? 0.15 : w * 0.6
      const wba = kb === 'column' && ka === 'table' ? 0.85 : kb === 'table' ? 0.15 : w * 0.6
      if (snap[a] * wab > score[b].score) { score[b].score = snap[a] * wab; score[b].evidence.push(`propagated from ${a}`) }
      if (snap[b] * wba > score[a].score) { score[a].score = snap[b] * wba; score[a].evidence.push(`propagated from ${b}`) }
    }
  }

  let tables = SCHEMA.map((t) => t.name).filter((t) => score[t].score >= threshold)
  if (!tables.length) tables = [Object.values(score).filter((n) => n.kind === 'table').sort((a, b) => b.score - a.score)[0].id]

  // Stage 3 — bridge tables (keep the sub-graph connected)
  const adj = fkTableEdges()
  const joinPaths: string[][] = []
  // greedy Steiner tree: repeatedly attach the unconnected table that is closest to the connected set
  const connected = [tables[0]]
  const pending = tables.slice(1)
  while (pending.length) {
    let best: string[] = []
    for (const t of pending)
      for (const c of connected) {
        const p = shortestPath(c, t, adj, tables)
        if (p.length && (!best.length || p.length < best.length)) best = p
      }
    if (!best.length) break
    pending.splice(pending.indexOf(best[best.length - 1]), 1)
    joinPaths.push(best)
    for (const x of best) if (!connected.includes(x)) connected.push(x)
    for (const x of best) if (!tables.includes(x)) { tables.push(x); score[x].evidence.push('bridge table (join path)') }
  }

  const columns = Object.values(score)
    .filter((n) => n.kind === 'column' && n.score >= threshold && tables.includes(n.id.split('.')[0]))
    .map((n) => n.id)

  return {
    tokens,
    nodes: Object.values(score).sort((a, b) => b.score - a.score),
    tables,
    columns,
    joinPaths,
    prunedSchema: schemaDDL(tables),
    fullSchema: schemaDDL(SCHEMA.map((t) => t.name)),
  }
}

/** Small hand-labelled dev set for measuring linking quality without any LLM call. */
export const DEV_SET: { q: string; gold: string[] }[] = [
  { q: 'Which pupils have a gpa above 9?', gold: ['student'] },
  { q: 'Show the roll number of students from Kolkata', gold: ['student'] },
  { q: 'How much does each professor earn?', gold: ['instructor'] },
  { q: 'List subjects taught by Dr. Meera Iyer', gold: ['course', 'instructor'] },
  { q: 'Which branch has the largest funding?', gold: ['department'] },
  { q: 'Names of students registered in Machine Learning', gold: ['student', 'enrollment', 'course'] },
  { q: 'Average cgpa of learners in Computer Science', gold: ['student', 'department'] },
  { q: 'How many credits is Thermodynamics worth?', gold: ['course'] },
  { q: 'Which teachers belong to the Electronics dept?', gold: ['instructor', 'department'] },
  { q: 'Students who got grade A in the 2026-ODD term', gold: ['student', 'enrollment'] },
  { q: 'Total salary paid per department', gold: ['instructor', 'department'] },
  { q: 'Which building is the Mathematics faculty located in?', gold: ['department'] },
  { q: 'Count of students taking courses by Dr. Arjun Rao', gold: ['student', 'enrollment', 'course', 'instructor'] },
  { q: 'Who is the topper of 3rd year?', gold: ['student'] },
  { q: 'List electives with 4 credits offered by the Computer Science branch', gold: ['course', 'department'] },
]

/** Baseline for comparison: exact table/column-name string matching only (no synonyms, values or graph). */
export function naiveLink(question: string): string[] {
  const toks = new Set(tokenize(question).map(stem))
  return SCHEMA.filter((t) => toks.has(stem(t.name)) || t.columns.some((c) => !c.name.endsWith('_id') && toks.has(stem(c.name)))).map((t) => t.name)
}

export function evaluate(values: Record<string, string[]>) {
  const rows = DEV_SET.map((d) => {
    const graph = linkSchema(d.q, values).tables
    const naive = naiveLink(d.q)
    const pr = (pred: string[]) => {
      const tp = pred.filter((t) => d.gold.includes(t)).length
      return { p: pred.length ? tp / pred.length : 0, r: tp / d.gold.length, exact: tp === d.gold.length && pred.length === d.gold.length }
    }
    return { ...d, graph, naive, g: pr(graph), n: pr(naive) }
  })
  const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length
  const f1 = (p: number, r: number) => (p + r ? (2 * p * r) / (p + r) : 0)
  const gp = avg((r) => r.g.p), gr = avg((r) => r.g.r), np = avg((r) => r.n.p), nr = avg((r) => r.n.r)
  return {
    rows,
    graph: { p: gp, r: gr, f1: f1(gp, gr), exact: avg((r) => +r.g.exact) },
    naive: { p: np, r: nr, f1: f1(np, nr), exact: avg((r) => +r.n.exact) },
  }
}
