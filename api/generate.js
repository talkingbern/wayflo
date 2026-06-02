// api/generate.js
// Vercel Serverless Function — Node.js runtime
// Required env var: ANTHROPIC_API_KEY

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server misconfiguration: missing API key." });

  const {
    destination, dateFrom, dateTo, budget, origin,
    travelStyle, interests, refineFeedback, previousItinerary,
  } = req.body ?? {};

  if (!destination || !dateFrom || !dateTo || !budget || !travelStyle) {
    return res.status(400).json({ error: "Missing required trip fields." });
  }

  const tripDays = Math.round(
    (new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)
  );

  const isRefinement = Boolean(refineFeedback && previousItinerary);

  const systemPrompt = `You are Wayflo, a travel planner for budget backpackers aged 18-25.
Your output is ALWAYS a single valid JSON object — no markdown fences, no prose outside the JSON.
Write day content as SHORT punchy bullet points (3-5 bullets per day, max 15 words each).
Never pad with cost breakdowns or running totals — mention prices only when genuinely surprising or useful.
Tone: excited friend who's been there, not a travel brochure.`;

  const tripContext = `Destination: ${destination}
${origin ? `Travelling from: ${origin}` : ""}
Dates: ${dateFrom} to ${dateTo} (${tripDays} days)
Total budget: ${budget}
Travel style: ${travelStyle}
Interests: ${Array.isArray(interests) ? interests.join(", ") : interests || "general"}`;

  const freshPrompt = `Generate a day-by-day backpacker itinerary.

${tripContext}

Include:
- A Day 0 "Getting There" entry covering travel from origin to destination (flights, buses, trains — real routes and rough costs if origin is provided)
- One entry per full day (Day 1 through Day ${tripDays})
- A final "Getting Home" entry

Each day: 3-5 bullet points. Real place names. Scannable, not an essay.

JSON format (no markdown fences):
{
  "intro": "2 punchy sentences. Make it exciting.",
  "photoQuery": "short Unsplash search query for a stunning photo of this destination, e.g. 'Hanoi Vietnam street'",
  "days": [
    { "title": "Day 0 — Getting There", "content": "• bullet\\n• bullet\\n• bullet" },
    { "title": "Day 1 — Title Here", "content": "• bullet\\n• bullet\\n• bullet" }
  ]
}`;

  const refinePrompt = `Update this itinerary based on feedback: ${refineFeedback}

Original trip:
${tripContext}

Previous itinerary:
${previousItinerary}

Return only the updated JSON in the same format. No markdown fences.`;

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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: isRefinement ? refinePrompt : freshPrompt }],
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
  return res.status(200).json({ raw: rawText });
}
