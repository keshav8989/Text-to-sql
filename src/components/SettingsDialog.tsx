import { useState } from 'react'
import { PROVIDERS, listModels, pickModel, type LlmConfig } from '../lib/llm'

export default function SettingsDialog({ value, onSave, onClose }: { value: LlmConfig; onSave: (c: LlmConfig) => void; onClose: () => void }) {
  const [c, setC] = useState(value)
  const [show, setShow] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const test = async () => {
    setStatus('Checking key…')
    try {
      const list = await listModels(c)
      setModels(list)
      const keep = list.includes(c.model) ? c.model : pickModel(list) ?? c.model
      setC({ ...c, model: keep })
      setStatus(`✓ Key works · ${list.length} models available · using ${keep}`)
    } catch (e) {
      setStatus(`✗ ${(e as Error).message}`)
    }
  }
  const field = 'w-full bg-card border border-rule px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-ink transition-colors'
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-paper border border-ink shadow-[8px_8px_0_#1b1a17]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-ink text-paper px-5 py-3">
          <span className="font-display font-bold">LLM API settings</span>
          <button onClick={onClose} className="font-mono text-sm hover:text-vermilion" aria-label="Close">✕</button>
        </div>
        <div className="p-6 space-y-5">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-dim">Provider</span>
            <select className={field + ' mt-1.5'} value={c.provider}
              onChange={(e) => { const p = PROVIDERS.find((x) => x.id === e.target.value)!; setC({ ...c, provider: p.id, baseUrl: p.baseUrl || c.baseUrl, model: p.model || c.model }) }}>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-dim">API key</span>
            <div className="flex mt-1.5">
              <input className={field} type={show ? 'text' : 'password'} placeholder="paste your key here" value={c.apiKey} onChange={(e) => setC({ ...c, apiKey: e.target.value.trim() })} />
              <button onClick={() => setShow(!show)} className="border border-l-0 border-rule px-3 font-mono text-xs hover:bg-card">{show ? 'hide' : 'show'}</button>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block col-span-2 sm:col-span-1">
              <span className="font-mono text-[11px] uppercase tracking-widest text-dim">Model</span>
              {models.length ? (
                <select className={field + ' mt-1.5'} value={c.model} onChange={(e) => setC({ ...c, model: e.target.value })}>
                  {models.map((m) => <option key={m}>{m}</option>)}
                </select>
              ) : (
                <input className={field + ' mt-1.5'} value={c.model} onChange={(e) => setC({ ...c, model: e.target.value })} />
              )}
            </label>
            <label className="block col-span-2 sm:col-span-1">
              <span className="font-mono text-[11px] uppercase tracking-widest text-dim">Base URL</span>
              <input className={field + ' mt-1.5'} value={c.baseUrl} onChange={(e) => setC({ ...c, baseUrl: e.target.value })} />
            </label>
          </div>
          {status && <p className={`font-mono text-xs break-words ${status.startsWith('✓') ? 'text-moss' : status.startsWith('✗') ? 'text-vermilion' : 'text-dim'}`}>{status}</p>}
          <p className="text-xs text-dim leading-relaxed">
            The key stays in this browser only (localStorage) and is sent straight to the provider. It never touches the project code.
            Free keys: Google AI Studio (Gemini) or console.groq.com.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={test} disabled={!c.apiKey} className="px-4 py-2 font-mono text-xs border border-ink hover:bg-ink hover:text-card disabled:opacity-30 mr-auto">Test key & load models</button>
            <button onClick={() => { onSave({ ...c, apiKey: '' }) }} className="px-4 py-2 font-mono text-xs border border-rule hover:border-ink">Clear key</button>
            <button onClick={() => { onSave(c); onClose() }} className="px-5 py-2 bg-vermilion text-card font-medium hover:bg-ink transition-colors">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
