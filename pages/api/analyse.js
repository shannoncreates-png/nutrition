export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { food } = req.body;
  if (!food || !food.trim()) {
    return res.status(400).json({ error: 'Missing food description' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key' });
  }

  const prompt = `You are a nutrition expert. Analyse this food and return ONLY valid JSON — no markdown, no explanation, raw JSON only.

Food: "${food.trim()}"

Return exactly this structure:
{
  "name": "short friendly name max 40 chars",
  "emoji": "single most relevant food emoji",
  "cal": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fibre": number,
  "sugar": number,
  "sodium": number,
  "note": "one useful nutritional insight max 70 chars",
  "portionQuestion": {
    "subject": "the main food item name",
    "options": [
      {"label": "Small / half portion", "multiplier": 0.5},
      {"label": "Standard portion", "multiplier": 1.0},
      {"label": "Large / double", "multiplier": 1.5},
      {"label": "Extra large / triple", "multiplier": 2.0}
    ]
  }
}

All macros in numbers. protein/carbs/fat/fibre/sugar in grams. sodium in mg. cal as kcal.
Base estimates on a STANDARD single portion. Customise option labels to match the food.`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return res.status(502).json({ error: 'Upstream error', detail: err });
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
