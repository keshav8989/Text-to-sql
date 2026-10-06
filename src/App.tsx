import { useEffect, useState } from 'react'
import SchemaGraph from './components/SchemaGraph'
import SettingsDialog from './components/SettingsDialog'
import { getCellValues, runSql, type QueryResult } from './lib/db'
import { linkSchema, type LinkResult } from './lib/linker'
import { buildPrompt, generateSql, loadConfig, saveConfig, suggestedModel, listModels, pickModel, type LlmConfig } from './lib/llm'

const EXAMPLES = [
  'Which pupils have a gpa above 9?',
  'Names of students registered in Machine Learning',
  'How much does each professor earn?',
  'Total salary paid per department',
  'Count of students taking courses by Dr. Arjun Rao',
  'Which building is the Mathematics faculty located in?',
]

function Label({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-ink pb-3 mb-8">
      <span className="font-mono text-sm text-vermilion">§{n}</span>
      <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{children}</h2>
    </div>
  )
}

export default function App() {
  const [cfg, setCfg] = useState<LlmConfig>(loadConfig)
  const [settings, setSettings] = useState(false)
  const [values, setValues] = useState<Record<string, string[]>>({})
  const [q, setQ] = useState(EXAMPLES[1])
  const [useLinking, setUseLinking] = useState(true)
  const [link, setLink] = useState<LinkResult | null>(null)
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => { getCellValues().then(setValues) }, [])

  const prompt = link ? buildPrompt(q, useLinking ? link.prunedSchema : link.fullSchema, useLinking ? link : undefined) : ''
  const execute = async (s: string) => {
    try { setResult(await runSql(s)); setError('') } catch (e) { setResult(null); setError(`Execution error: ${(e as Error).message}`) }
  }

  const ask = async () => {
    const l = linkSchema(q, values)
    setLink(l); setResult(null); setError(''); setSql('')
    if (!cfg.apiKey) { setError('Schema linked. Add an API key in Settings to generate SQL (or type SQL below and press Run).'); return }
    setBusy(true)
    try {
      const p = buildPrompt(q, useLinking ? l.prunedSchema : l.fullSchema, useLinking ? l : undefined)
      let out: string
      try {
        out = await generateSql(cfg, p)
      } catch (e) {
        // provider retired the model: switch to the one it recommends and retry once
        const msg = (e as Error).message
        let next = suggestedModel(msg)
        if (!next && /not exist|not found|no longer|decommission|deprecat|unavailable|access to/i.test(msg))
          next = pickModel(await listModels(cfg).catch(() => []))
        if (!next || next === cfg.model) throw e
        const c = { ...cfg, model: next }
        setCfg(c); saveConfig(c)
        out = await generateSql(c, p)
      }
      setSql(out)
      await execute(out)
    } catch (e) { setError(`LLM error: ${(e as Error).message}`) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen">
      {/* masthead */}
      <header className="border-b border-ink">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between font-mono text-xs">
          <span className="tracking-widest uppercase">Text-to-SQL · Mid-Semester Build</span>
          <div className="flex items-center gap-5">
            <a href="/Text2SQL_MidSem_Report.pdf" target="_blank" className="hover:text-vermilion underline-offset-4 hover:underline">Report PDF ↓</a>
            <button onClick={() => setSettings(true)} className={`flex items-center gap-2 border px-3 py-1.5 transition-colors ${cfg.apiKey ? 'border-moss text-moss hover:bg-moss hover:text-card' : 'border-vermilion text-vermilion hover:bg-vermilion hover:text-card'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.apiKey ? 'bg-moss' : 'bg-vermilion animate-pulse'}`} />
              {cfg.apiKey ? `API · ${cfg.model}` : 'Add API key'}
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-16 pb-14 grid lg:grid-cols-[1.4fr_1fr] gap-12 items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-dim mb-5">Phase I of II · Problem 1: Schema Linking</p>
          <h1 className="font-display font-extrabold text-5xl md:text-7xl leading-[0.95] tracking-tight">
            Ask the database<br />in <em className="text-vermilion not-italic">plain English.</em>
          </h1>
        </div>
        <p className="text-lg leading-relaxed text-dim max-w-md">
          Before the LLM sees anything, a <strong className="text-ink">graph-based schema linker</strong> works out which tables and columns the question is about, including synonyms like
          “pupil → student” and “earn → salary”. It also finds the join path between them. Only that smaller schema goes into the prompt.
        </p>
      </section>

      {/* 01 console */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <Label n="01">Query console</Label>
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-8">
          <div className="space-y-5">
            <div className="bg-card border border-ink">
              <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask() }}
                className="w-full bg-transparent p-5 font-display text-xl resize-none focus:outline-none" placeholder="e.g. Which professors earn more than 1.5 lakh?" />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-5 py-3">
                <label className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={useLinking} onChange={(e) => setUseLinking(e.target.checked)} className="accent-vermilion" />
                  graph schema linking {useLinking ? 'ON' : 'OFF (full-schema baseline)'}
                </label>
                <button onClick={ask} disabled={busy} className="bg-ink text-card px-6 py-2.5 font-medium hover:bg-vermilion transition-colors disabled:opacity-50">
                  {busy ? 'Generating…' : 'Link & generate →'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => setQ(e)} className="text-sm border border-rule px-3 py-1.5 hover:border-ink hover:bg-card transition-colors">{e}</button>
              ))}
            </div>

            <div className="border border-ink bg-[#1b1a17] text-[#f3efe6]">
              <div className="flex justify-between items-center px-4 py-2 border-b border-white/10 font-mono text-[11px] uppercase tracking-widest text-white/50">
                <span>generated sql: editable</span>
                <button onClick={() => execute(sql)} disabled={!sql.trim()} className="text-[#f3efe6] hover:text-vermilion disabled:opacity-30">Run ▸</button>
              </div>
              <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={5} spellCheck={false}
                placeholder="-- SQL appears here"
                className="w-full bg-transparent p-4 font-mono text-sm resize-none focus:outline-none placeholder:text-white/30" />
            </div>
            {error && <p className="font-mono text-sm text-vermilion border-l-2 border-vermilion pl-3">{error}</p>}
            {result && (
              <div className="border border-ink bg-card overflow-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-paper sticky top-0">
                    <tr>{result.columns.map((c) => <th key={c} className="text-left font-mono text-xs uppercase tracking-wide px-4 py-2 border-b border-ink">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => (
                      <tr key={i} className="border-b border-rule last:border-0 hover:bg-paper">
                        {r.map((v, j) => <td key={j} className="px-4 py-2 font-mono text-[13px]">{String(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!result.rows.length && <p className="p-4 font-mono text-sm text-dim">Query ran: 0 rows.</p>}
                <p className="px-4 py-2 font-mono text-[11px] text-dim border-t border-rule">{result.rows.length} rows · executed in-browser on SQLite</p>
              </div>
            )}
          </div>

          {/* linker trace */}
          <aside className="border border-ink bg-card p-6 self-start">
            <h3 className="font-mono text-xs uppercase tracking-widest text-dim mb-4">Linker trace</h3>
            {!link ? (
              <p className="text-dim">Press <span className="font-mono text-ink">Link & generate</span> to see which schema items the linker picks and why.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="font-mono text-[11px] text-dim mb-1.5">content tokens</p>
                  <div className="flex flex-wrap gap-1.5">{link.tokens.map((t, i) => <span key={i} className="font-mono text-xs bg-paper border border-rule px-2 py-0.5">{t}</span>)}</div>
                </div>
                <div>
                  <p className="font-mono text-[11px] text-dim mb-1.5">ranked schema nodes</p>
                  <ul className="divide-y divide-rule">
                    {link.nodes.filter((n) => n.score > 0.2).slice(0, 8).map((n) => (
                      <li key={n.id} className="py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`font-mono text-sm ${link.tables.includes(n.id) || link.columns.includes(n.id) ? 'text-vermilion' : ''}`}>{n.id}</span>
                          <span className="font-mono text-xs">{n.score.toFixed(2)}</span>
                        </div>
                        <div className="h-1 bg-paper mt-1"><div className="h-full bg-vermilion transition-all duration-700" style={{ width: `${Math.min(n.score, 1) * 100}%` }} /></div>
                        <p className="text-xs text-dim mt-1 truncate">{[...new Set(n.evidence)].slice(0, 2).join(' · ')}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                {link.joinPaths.length > 0 && (
                  <div>
                    <p className="font-mono text-[11px] text-dim mb-1.5">join paths (Steiner bridge)</p>
                    {link.joinPaths.map((p, i) => <p key={i} className="font-mono text-sm">{p.join(' ⟶ ')}</p>)}
                  </div>
                )}
                <div className="flex gap-6 font-mono text-xs border-t border-rule pt-4">
                  <span>tables <b className="text-base">{link.tables.length}</b>/5</span>
                  <span>prompt <b className="text-base">{prompt.length}</b> chars</span>
                </div>
                <button onClick={() => setShowPrompt(!showPrompt)} className="font-mono text-xs underline underline-offset-4 hover:text-vermilion">{showPrompt ? 'hide' : 'view'} LLM prompt</button>
                {showPrompt && <pre className="text-[11px] font-mono bg-paper border border-rule p-3 overflow-auto max-h-72 whitespace-pre-wrap">{prompt}</pre>}
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* 02 graph */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <Label n="02">Schema graph</Label>
        <div className="border border-ink bg-card/60 p-4"><SchemaGraph link={link} /></div>
      </section>

      <footer className="border-t border-ink">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between font-mono text-xs text-dim">
          <span>Text-to-SQL Mini Project · 2026</span><span>React · SQLite (sql.js) · OpenAI-compatible LLM API</span>
        </div>
      </footer>

      {settings && <SettingsDialog value={cfg} onClose={() => setSettings(false)} onSave={(c) => { setCfg(c); saveConfig(c) }} />}
    </div>
  )
}
