// api/generate.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) return res.status(500).json({ error: "Missing API key." });

  const { destination, dateFrom, dateTo, budget, origin, travelStyle, interests, refineFeedback, previousItinerary, userId } = req.body ?? {};
  let dbPaidTrips = 0; // declared at top level so increment section can access it
  if (!destination || !dateFrom || !dateTo || !budget || !travelStyle) return res.status(400).json({ error: "Missing required fields." });

  // ── Trip limit enforcement ─────────────────────────────────────────────────
  if (userId && supabaseUrl && supabaseKey) {
    let tripsGenerated = 0;
    try {
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=trips_generated,paid_trips`, {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        }
      });
      const profiles = await profileRes.json();
      const profile  = profiles?.[0];

      if (!profile) {
        await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ id: userId, trips_generated: 0, paid_trips: 0 }),
        });
        tripsGenerated = 0;
        dbPaidTrips = 0;
      } else {
        tripsGenerated = profile.trips_generated || 0;
        dbPaidTrips    = profile.paid_trips || 0;
      }
    } catch(e) {
      console.error("Profile check failed:", e.message, e.stack);
    }

    console.log(`Trip limit check for user ${userId}: tripsGenerated=${tripsGenerated}, dbPaidTrips=${dbPaidTrips}`);

    if (tripsGenerated >= 3 && dbPaidTrips < 1) {
      console.log("BLOCKING - payment required");
      return res.status(402).json({ error: "payment_required" });
    }
  }

  const tripDays     = Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
  const isRefinement = Boolean(refineFeedback && previousItinerary);

  const systemPrompt = `You are Wayflo, a travel planner for budget backpackers aged 18-25.
Your output is ALWAYS a single valid JSON object. NEVER use markdown code fences. No prose before or after the JSON. Start your response with { and end with }.
Write day content as SHORT punchy bullet points (3-5 bullets per day, max 15 words each).
Tone: excited friend who has been there, not a travel brochure.

CRITICAL RULES FOR TRANSPORT ESTIMATES:
- Always give price RANGES not single figures. Format: "from ~$X, typically $X-$X booked in advance"
- Always give time RANGES not exact times. Format: "allow X-Xhrs depending on route/stops"
- The lower end should reflect best-case advance booking. The upper end should reflect average/walk-up.
- Never imply one price is what the user will pay. Prices vary by season and booking time.
- For flights: note that prices vary hugely and to set a Google Flights alert.

EVENTS AWARENESS:
- If any major festivals, sporting events, concerts, or cultural events are known to occur at the destination during the trip dates, mention them specifically on the relevant day.
- Examples: Carnival in Rio, Running of the Bulls in Pamplona, Guelaguetza in Oaxaca, Glastonbury, Oktoberfest, World Cup matches, Olympics, major marathons, national holidays.
- Note if events mean prices will be higher or booking needs to happen further in advance.
- Only mention events you are confident occur during those dates — do not invent events.`;

  const tripContext = `Destination: ${destination}
${origin ? "Travelling from: " + origin : ""}
Dates: ${dateFrom} to ${dateTo} (${tripDays} days)
Total budget: ${budget}
Travel style: ${travelStyle}
Interests: ${Array.isArray(interests) ? interests.join(", ") : interests || "general"}`;

  const freshPrompt = `Generate a day-by-day backpacker itinerary.

${tripContext}

Include:
- A Day 0 "Getting There" entry with honest price/time ranges
- One entry per full day (Day 1 through Day ${tripDays})
- A final "Getting Home" entry

Each day: 3-5 bullet points. Real place names. Scannable, not an essay.

  "intro": "2 punchy sentences.",
  "photoQuery": "short Unsplash search query",
  "days": [
    {
      "title": "Day 0 — Getting There",
      "content": "bullet\\nbullet\\nbullet",
      "lat": 46.0569,
      "lng": 14.5058,
      "locationName": "Ljubljana, Slovenia",
      "transportType": "train",
    },
    {
      "title": "Day 1 — Title",
      "content": "bullet\\nbullet\\nbullet",
      "lat": 46.0569,
      "lng": 14.5058,
      "locationName": "Ljubljana Old Town",
}`;

  const refinePrompt = `Update this itinerary based on feedback: ${refineFeedback}

Original trip: ${tripContext}
Previous itinerary: ${previousItinerary}

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
  } catch(e) {
    return res.status(502).json({ error: "Could not reach AI service." });
  }

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error("Anthropic error:", anthropicRes.status, err);
    if (anthropicRes.status === 429) {
      return res.status(503).json({ error: "We're experiencing high demand right now. Please try again in a few minutes." });
    }
    if (anthropicRes.status === 402 || (err && err.includes("credit"))) {
      return res.status(503).json({ error: "Service temporarily unavailable. Please try again later." });
    }
    return res.status(502).json({ error: "AI service error: " + anthropicRes.status });
  }

  const data    = await anthropicRes.json();
  const rawText = (data.content ?? []).map(b => b.text ?? "").join("");

  // ── Update counters for logged-in users ──────────────────────────────────
  if (userId && supabaseUrl && supabaseKey) {
    // Increment trips_generated via RPC
    await fetch(`${supabaseUrl}/rest/v1/rpc/increment_trips`, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    }).catch(() => {});

    // If this was a paid trip, decrement paid_trips
    if (dbPaidTrips > 0) {
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ paid_trips: dbPaidTrips - 1 }),
      }).catch(() => {});
    }
  }

  return res.status(200).json({ raw: rawText });
}
