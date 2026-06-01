// api/generate.js
// Vercel Serverless Function — Node.js runtime
// Proxies itinerary generation requests to the Anthropic API server-side.
// Required env var: ANTHROPIC_API_KEY (set in Vercel dashboard, NOT prefixed with VITE_)

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  // ── Only allow POST ────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate API key is present server-side ────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in environment variables.");
    return res.status(500).json({ error: "Server misconfiguration: missing API key." });
  }

  // ── Parse and validate request body ───────────────────────────────────────
  const { destination, dateFrom, dateTo, budget, travelStyle, interests, refineFeedback, previousItinerary } = req.body ?? {};

  if (!destination || !dateFrom || !dateTo || !budget || !travelStyle) {
    return res.status(400).json({ error: "Missing required trip fields." });
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  const isRefinement = Boolean(refineFeedback && previousItinerary);

  const userMessage = isRefinement
    ? `Update the following travel itinerary based on this feedback: ${refineFeedback}

Previous itinerary:
${previousItinerary}

Original trip details:
- Destination: ${destination}
- Dates: ${dateFrom} to ${dateTo}
- Daily budget: ${budget}
- Travel style: ${travelStyle}
- Interests: ${(interests ?? []).join(", ")}

Return only the updated JSON object in the same format. No markdown fences.`
    : `Generate a detailed day-by-day travel itinerary for:
- Destination: ${destination}
- Dates: ${dateFrom} to ${dateTo}
- Daily budget: ${budget}
- Travel style: ${travelStyle}
- Interests: ${(interests ?? []).join(", ")}

Be specific: name real hostels, budget restaurants, local transport options, and entry fees.
Keep it practical and exciting for a backpacker aged 18-25.

Return only a JSON object (no markdown fences) in this exact format:
{
  "intro": "A 2-3 sentence hook about this trip.",
  "days": [
    { "title": "Day title here", "content": "Detailed plan with times, places, tips, cost estimates." }
  ]
}`;

  // ── Call Anthropic API ─────────────────────────────────────────────────────
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: "You are Wayflo, a friendly and knowledgeable travel planner for budget backpackers. You give honest, practical, specific advice. You always respond with valid JSON only — no prose outside the JSON object, no markdown code fences.",
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch (networkErr) {
    console.error("Network error reaching Anthropic:", networkErr);
    return res.status(502).json({ error: "Could not reach the AI service. Try again." });
  }

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text();
    console.error(`Anthropic API error ${anthropicRes.status}:`, errBody);
    return res.status(502).json({ error: `AI service error: ${anthropicRes.status}` });
  }

  const data = await anthropicRes.json();
  const rawText = (data.content ?? []).map(b => b.text ?? "").join("");

  // ── Return raw text — let the frontend parse JSON ──────────────────────────
  return res.status(200).json({ raw: rawText });
}
