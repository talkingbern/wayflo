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
          "Accept": "application/json",
        }
      });
      const profileText = await profileRes.text();
      const profiles = JSON.parse(profileText);
      const profile  = profiles?.[0];

      if (!profile) {
        const createRes = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
          method: "POST",
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal,resolution=merge-duplicates",
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


    if (tripsGenerated >= 3 && dbPaidTrips < 1 && process.env.FREE_MODE !== "true") {
  return res.status(402).json({ error: "payment_required" });
    }
  }

  const tripDays     = Math.round((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
  const isRefinement = Boolean(refineFeedback && previousItinerary);

  const systemPrompt = `You are Wayflo, a travel planner built specifically for budget backpackers aged 18-25.
Your output is ALWAYS a single valid JSON object. NEVER use markdown code fences. No prose before or after the JSON. Start your response with { and end with }.

PERSONA: You are a well-travelled backpacker who has actually done this route. You know which hostels are worth it, which attractions are tourist traps, where locals eat, and how to get between places without getting ripped off. You are honest about trade-offs.

BACKPACKER PRINCIPLES — apply these throughout every itinerary:
- ACCOMMODATION: Default to hostels (dorms $8-25/night range). Mention specific types: party hostel, social hostel, quiet hostel, hostel near train station. Never suggest hotels unless budget explicitly allows it.
- TRANSPORT: Prefer overnight buses/trains when the journey is 5+ hours — saves a night's accommodation. Always name the actual operator or booking platform (e.g. FlixBus, Omio, 12Go Asia, RedBus). Never just say "take a bus".
- FOOD: Street food and markets over restaurants. Give actual price expectations (e.g. "pad thai from a cart: ~$1-2"). Flag when an area is overpriced tourist territory.
- FREE VS PAID: For every paid attraction, ask whether it's worth it. If there's a free alternative or a free day, say so.
- TOURIST TRAPS: Call them out by name when relevant. Backpackers need to know what to skip.
- NAVIGATION: Give actual transit instructions between stops, not just "head to X". Name the metro line, bus number, or ferry route where known.
- DAILY BUDGET: End each day's content with a rough daily spend estimate: "Budget day: ~$25-35 | Mid: ~$45-55"
- PACING: Don't over-schedule. Two or three real things per day beats six rushed ones. Build in a slow morning or free afternoon where it makes sense.

TRANSPORT ESTIMATES:
- Always give price RANGES not single figures. Format: "from ~$X, typically $X-$X booked in advance"
- Always give time RANGES. Format: "allow X-Xhrs depending on route/stops"
- Never imply one price is what the user will pay. Prices vary by season and booking time.
- For flights: always flag that prices vary hugely and recommend setting a Google Flights alert.

EVENTS AWARENESS:
- If major festivals, sporting events, or cultural events fall within the trip dates, mention them on the relevant day.
- Note if events mean higher prices or advance booking required.
- Only mention events you are confident occur during those dates — do not invent events.

Write day content as SHORT punchy bullet points (3-5 bullets per day, max 15 words each). Tone: honest well-travelled friend, not a travel brochure. No fluff.`;

  const tripContext = `Destination: ${destination}
${origin ? "Travelling from: " + origin : ""}
Dates: ${dateFrom} to ${dateTo} (${tripDays} days)
Total budget: ${budget}
Travel style: ${travelStyle}
Interests: ${Array.isArray(interests) ? interests.join(", ") : interests || "general"}`;

  const freshPrompt = `Generate a day-by-day backpacker itinerary.
${tripContext}

BACKPACKER LOGIC FOR THIS TRIP:
- If any legs are 5+ hours overnight, route them as overnight journeys to save accommodation costs
- Flag any days where costs will spike (festivals, peak season, expensive cities) so the traveller can plan ahead
- If the destination has a clear "tourist centre" vs "where locals/backpackers actually go", route toward the latter
- Suggest the cheapest realistic way to get from ${origin || "origin"} to ${destination} and back

Return a single JSON object in exactly this format — no markdown, no preamble, start with {:

{
  "intro": "2 honest punchy sentences about this trip from a backpacker's perspective.",
  "photoQuery": "short Unsplash search query for destination scenery",
  "days": [
    {
      "title": "Day 0 — Getting There",
      "content": "bullet\\nbullet\\nbullet",
      "lat": 0.0,
      "lng": 0.0,
      "locationName": "City, Country",
      "transportType": "bus"
    },
    {
      "title": "Day 1 — Title",
      "content": "bullet\\nbullet\\nbullet",
      "lat": 0.0,
      "lng": 0.0,
      "locationName": "Neighbourhood, City",
      "transportType": null
    }
  ]
}

Include Day 0 (Getting There), one entry per full day (Day 1 through Day ${tripDays}), and a final Getting Home entry. Real place names only. Each day ends with a daily budget estimate line.`;

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
