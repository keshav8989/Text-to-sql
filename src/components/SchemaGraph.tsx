import { SCHEMA } from '../lib/db'
import type { LinkResult } from '../lib/linker'

const POS: Record<string, [number, number]> = {
  student: [30, 30],
  department: [330, 20],
  instructor: [630, 30],
  enrollment: [130, 290],
  course: [500, 290],
}
const W = 210
const ROW = 22

export default function SchemaGraph({ link }: { link: LinkResult | null }) {
  const score = Object.fromEntries((link?.nodes ?? []).map((n) => [n.id, n.score]))
  const colY = (t: string, c: string) => {
    const tbl = SCHEMA.find((x) => x.name === t)!
    return POS[t][1] + 36 + tbl.columns.findIndex((x) => x.name === c) * ROW + ROW / 2
  }
  const edges = SCHEMA.flatMap((t) =>
    t.columns.filter((c) => c.fk).map((c) => {
      const [ft, fc] = c.fk!.split('.')
      return { from: [t.name, c.name], to: [ft, fc] }
    }),
  )
  const active = (t: string) => link?.tables.includes(t)

  return (
    <svg viewBox="0 0 870 470" className="w-full h-auto">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#6b665c" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const [a, b] = [e.from, e.to]
        const ax = POS[a[0]][0] + (POS[b[0]][0] > POS[a[0]][0] ? W : 0)
        const bx = POS[b[0]][0] + (POS[b[0]][0] > POS[a[0]][0] ? 0 : W)
        const ay = colY(a[0], a[1]), by = colY(b[0], b[1])
        const hot = active(a[0]) && active(b[0])
        const mx = (ax + bx) / 2
        return (
          <path key={i} d={`M${ax} ${ay} C${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`} fill="none"
            stroke={hot ? '#c8401f' : '#b9b09d'} strokeWidth={hot ? 2 : 1} strokeDasharray={hot ? '' : '4 4'} markerEnd="url(#arr)"
            className="transition-all duration-500" />
        )
      })}
      {SCHEMA.map((t) => {
        const [x, y] = POS[t.name]
        const on = active(t.name)
        const h = 36 + t.columns.length * ROW + 6
        return (
          <g key={t.name} className="transition-opacity duration-500" opacity={link && !on ? 0.4 : 1}>
            <rect x={x} y={y} width={W} height={h} fill="#fbf9f4" stroke={on ? '#c8401f' : '#1b1a17'} strokeWidth={on ? 2 : 1} />
            <rect x={x} y={y} width={W} height={30} fill={on ? '#c8401f' : '#1b1a17'} />
            <text x={x + 10} y={y + 20} fill="#fbf9f4" fontFamily="Roboto Slab" fontWeight={700} fontSize={14}>{t.name}</text>
            {link && <text x={x + W - 10} y={y + 20} fill="#fbf9f4" fontFamily="DM Mono" fontSize={11} textAnchor="end">{(score[t.name] ?? 0).toFixed(2)}</text>}
            {t.columns.map((c, i) => {
              const id = `${t.name}.${c.name}`
              const s = score[id] ?? 0
              const lit = link?.columns.includes(id)
              const cy = y + 36 + i * ROW
              return (
                <g key={c.name}>
                  {link && <rect x={x + 1} y={cy} width={(W - 2) * Math.min(s, 1)} height={ROW - 2} fill={lit ? '#c8401f' : '#d8d1c2'} opacity={lit ? 0.18 : 0.5} />}
                  <text x={x + 10} y={cy + 15} fontFamily="DM Mono" fontSize={12} fill={lit ? '#c8401f' : '#1b1a17'} fontWeight={lit ? 500 : 400}>
                    {c.pk ? '◆ ' : c.fk ? '↗ ' : '· '}{c.name}
                  </text>
                  <text x={x + W - 10} y={cy + 15} fontFamily="DM Mono" fontSize={10} fill="#6b665c" textAnchor="end">{link ? s.toFixed(2) : c.type.toLowerCase()}</text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
