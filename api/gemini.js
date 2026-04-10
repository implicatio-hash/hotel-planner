// Vercel Serverless Function — Gemini API 프록시
// API 키는 Vercel 환경변수 GEMINI_API_KEY로 관리 (코드에 노출 없음)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });

  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  let lastError = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(25000),
      });

      if (response.status === 503 || response.status === 429) {
        lastError = `${response.status} from ${model}`;
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: errText });
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      return res.status(200).json({ text });

    } catch (e) {
      lastError = e.message;
      if (e.name === 'TimeoutError') continue;
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(503).json({ error: `All models failed: ${lastError}` });
}
