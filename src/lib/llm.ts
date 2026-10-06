// OpenAI-compatible chat client. The API key is entered in the app (Settings) and kept in localStorage only.
export type LlmConfig = { provider: string; baseUrl: string; model: string; apiKey: string }

export const PROVIDERS: { id: string; label: string; baseUrl: string; model: string }[] = [
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', baseUrl: '', model: '' },
]

const KEY = 't2sql.llm'
export const loadConfig = (): LlmConfig => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '')
    if (c?.provider) {
      // migrate configs saved with a retired default model
      if (/^gemini-(1\.|2\.0)/.test(c.model)) c.model = PROVIDERS[0].model
      return c
    }
  } catch {}
  const p = PROVIDERS[0]
  return { provider: p.id, baseUrl: p.baseUrl, model: p.model, apiKey: '' }
}
export const saveConfig = (c: LlmConfig) => localStorage.setItem(KEY, JSON.stringify(c))

export function buildPrompt(question: string, schema: string, linked?: { tables: string[]; columns: string[]; joinPaths: string[][] }) {
  const hints = linked
    ? `\n-- Schema linking hints (from graph linker):\n-- relevant tables: ${linked.tables.join(', ')}\n-- relevant columns: ${linked.columns.join(', ') || '(none detected)'}\n${linked.joinPaths.map((p) => `-- join path: ${p.join(' -> ')}`).join('\n')}`
    : ''
  return `You are an expert SQLite Text-to-SQL system.
Given the database schema and question, write ONE valid SQLite query that answers it.
Use only the tables/columns shown. Return only the SQL, no explanation, no markdown.

${schema}${hints}

-- Question: ${question}
SQL:`
}

/** Returns the replacement model when the provider reports the requested one as retired. */
export const suggestedModel = (msg: string) => msg.match(/use (?:models\/)?([\w.-]+-[\w.-]+)/i)?.[1]

export async function generateSql(cfg: LlmConfig, prompt: string): Promise<string> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.[0]?.error?.message || `HTTP ${res.status}`)
  const text: string = data.choices?.[0]?.message?.content ?? ''
  return text.replace(/```(sql)?/gi, '').trim().replace(/;?\s*$/, ';')
}

/** Lists the chat models this key can access (OpenAI-compatible GET /models). */
export async function listModels(cfg: LlmConfig): Promise<string[]> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error?.message || data?.[0]?.error?.message || `HTTP ${res.status}`)
  return (data.data ?? [])
    .map((m: { id: string }) => m.id.replace(/^models\//, ''))
    .filter((id: string) => !/embed|whisper|tts|audio|image|vision|guard|moderation|imagen|veo|aqa|dall-e/i.test(id))
    .sort()
}

/** Picks a sensible model from the available list: prefers flash/versatile/mini, newest version first. */
export function pickModel(models: string[]): string | undefined {
  const pref = [/gemini-[\d.]+-flash$/, /flash/, /versatile/, /llama/, /mini/, /gpt/]
  for (const re of pref) {
    const hit = models.filter((m) => re.test(m)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
    if (hit) return hit
  }
  return models[0]
}
