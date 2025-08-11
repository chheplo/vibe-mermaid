export class OpenAIProvider{
  /**
   * @param {string} apiBase like https://api.openai.com/v1
   * @param {string} apiKey bearer key
   */
  constructor(apiBase, apiKey){
    this.base = apiBase?.replace(/\/$/, '') || 'https://api.openai.com/v1';
    this.key = apiKey || '';
  }
  /**
   * @param {string} model
   * @param {{role:string,content:string}[]} messages
   * @returns {Promise<string>} assistant content
   */
  async chat(model, messages){
    if (!this.key) throw new Error('Missing API key');
    const body = {
      model,
      messages,
      temperature: 1,
      response_format: { type: 'json_object' },
    };
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok){
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || '';
    return content;
  }
}

export function buildPrompt(currentDiagram){
  return `You are Vibe Mermaid, an expert at writing and updating Mermaid diagrams.\n\nGoals:\n- Keep building on the current diagram based on user requests.\n- Return a short explanation and the full updated Mermaid code.\n- Prefer compact, readable, valid Mermaid.\n\nResponse JSON schema (strictly follow):\n{\n  "explanation": string,\n  "diagram": string // full Mermaid code\n}\n\nCurrent diagram:\n---\n${currentDiagram}\n---\n`;
}

export function ensureJsonObject(content){
  // Try parse as JSON first
  try { return JSON.parse(content); } catch {}
  // Try extract json block
  const block = /```json\n([\s\S]*?)```/m.exec(content);
  if (block){ try { return JSON.parse(block[1]); } catch {} }
  // Try looser braces
  const match = /\{[\s\S]*\}/m.exec(content);
  if (match){ try { return JSON.parse(match[0]); } catch {} }
  // Fallback
  return { explanation: content, diagram: '' };
}

