// api/inspire.js
// Serverless function for Inspire Me — keeps API key server-side
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing API key." });

  const { vibe, duration, budget, origin } = req.body ?? {};
  if (!vibe) return res.status(400).json({ error: "Missing vibe." });

  const prompt = `Suggest a perfect backpacker trip for someone who wants a ${vibe} vibe.
${duration ? "Trip length: " + duration : ""}
${budget ? "Budget: " + budget : ""}
${origin ? "Travelling from: " + origin : ""}

Reply ONLY with a JSON object, no markdown fences:
{
  "destination": "City, Country",
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "budget": "one of: $300-500 / $500-800 / $800-1200 / $1200-2000 / $2000+",
  "travelStyle": "one of: Solo adventure / Group travel / Slow travel / Fast-paced explorer / Off the beaten path / Digital nomad",
  "interests": ["up to 3 from: Street food & markets, Hiking & nature, History & culture, Nightlife, Art & architecture, Beaches, Photography, Volunteering"]
}`;

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch(e) {
    return res.status(502).json({ error: "Could not reach AI service." });
  }

  if (!anthropicRes.ok) {
    return res.status(502).json({ error: "AI service error: " + anthropicRes.status });
  }

  const data = await anthropicRes.json();
  const text = (data.content ?? []).map(b => b.text ?? "").join("");
  return res.status(200).json({ raw: text });
}
