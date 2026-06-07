// api/generate.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing API key." });

  const { destination, dateFrom, dateTo, budget, origin, travelStyle, interests, refineFeedback, previousItinerary } = req.body ?? {};
  if (!destination || !dateFrom || !dateTo || !budget || !travelStyle) return res.status(400).json({ error: "Missing required fields." });

  const tripDays = Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
  const isRefinement = Boolean(refineFeedback && previousItinerary);

  const systemPrompt = `You are Wayflo, a travel planner for budget backpackers aged 18-25.
Your output is ALWAYS a single valid JSON object, no markdown fences, no prose outside the JSON.
Write day content as SHORT punchy bullet points (3-5 bullets per day, max 15 words each).
Tone: excited friend who has been there, not a travel brochure.

CRITICAL RULES FOR TRANSPORT ESTIMATES:
- Always give price RANGES not single figures. Format: "from ~$X, typically $X-$X booked in advance"
- Always give time RANGES not exact times. Format: "allow X-Xhrs depending on route/stops"
- The lower end should reflect best-case advance booking. The upper end should reflect average/walk-up.
- Never imply one price is what the user will pay. Prices vary by season and booking time.
- For flights specifically: note that prices vary hugely and to set a Google Flights alert.`;

  const tripContext = `Destination: ${destination}
${origin ? "Travelling from: " + origin : ""}
Dates: ${dateFrom} to ${dateTo} (${tripDays} days)
Total budget: ${budget}
Travel style: ${travelStyle}
Interests: ${Array.isArray(interests) ? interests.join(", ") : interests || "general"}`;

  const freshPrompt = `Generate a day-by-day backpacker itinerary.

${tripContext}

Include:
- A Day 0 "Getting There" entry with honest price/time ranges for the journey
- One entry per full day (Day 1 through Day ${tripDays})
- A final "Getting Home" entry

Each day: 3-5 bullet points. Real place names. Scannable, not an essay.

For each day provide the main coordinate and location. For Day 0 and Getting Home also provide transportType.

JSON format (no markdown fences):
{
  "intro": "2 punchy sentences.",
  "photoQuery": "short Unsplash search query e.g. 'Ljubljana Slovenia old town'",
  "days": [
    {
      "title": "Day 0 — Getting There",
      "content": "bullet\nbullet\nbullet",
      "lat": 46.0569,
      "lng": 14.5058,
      "locationName": "Ljubljana, Slovenia",
      "transportType": "train"
    }
  ]
}`;

  const refinePrompt = `Update this itinerary based on feedback: ${refineFeedback}

Original trip:
${tripContext}

Previous itinerary:
${previousItinerary}

Return only the updated JSON in the same format with lat, lng, locationName and transportType per day. No markdown fences.`;

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
  } catch(e) {
    return res.status(502).json({ error: "Could not reach AI service." });
  }

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error("Anthropic error:", anthropicRes.status, err);
    return res.status(502).json({ error: "AI service error: " + anthropicRes.status });
  }

  const data = await anthropicRes.json();
  const rawText = (data.content ?? []).map(b => b.text ?? "").join("");
  return res.status(200).json({ raw: rawText });
}
