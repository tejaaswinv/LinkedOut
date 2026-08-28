function getAIConfig() {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, '');
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  return { baseUrl, apiKey, model, configured: Boolean(baseUrl && apiKey && model) };
}

function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export async function aiJson({ system, user, temperature = 0.1, maxTokens = 900 }) {
  const { baseUrl, apiKey, model, configured } = getAIConfig();
  if (!configured) return null;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    }),
    cache: 'no-store'
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI provider returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return extractJson(content);
}

export function aiIsConfigured() {
  return getAIConfig().configured;
}
