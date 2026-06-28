// api/reviews.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Missing config." });

  // ── GET — fetch approved reviews ─────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/reviews?approved=eq.true&order=created_at.desc&limit=20&select=id,destination,body,rating,display_name,created_at`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: "Failed to fetch reviews." });
    }
  }

  // ── POST — submit a review (auth gated) ──────────────────────────────────
  if (req.method === "POST") {
    const { userId, destination, body, rating, display_name } = req.body ?? {};
    if (!userId || !body?.trim() || !rating) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    if (body.trim().length < 20) {
      return res.status(400).json({ error: "Review too short — tell us a bit more." });
    }
    if (![1, 2, 3, 4, 5].includes(Number(rating))) {
      return res.status(400).json({ error: "Invalid rating." });
    }

    // Rate limit: one review per user per destination
    try {
      const existing = await fetch(
        `${supabaseUrl}/rest/v1/reviews?user_id=eq.${userId}&destination=eq.${encodeURIComponent(destination || "")}&select=id`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      const rows = await existing.json();
      if (rows?.length > 0) {
        return res.status(429).json({ error: "You've already reviewed this destination." });
      }
    } catch (e) {}

    try {
      const insert = await fetch(`${supabaseUrl}/rest/v1/reviews`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          destination: destination?.trim() || null,
          body: body.trim(),
          rating: Number(rating),
          display_name: display_name?.trim().slice(0, 40) || "Anonymous",
          approved: false, // you manually approve in Supabase dashboard
        }),
      });
      if (!insert.ok) throw new Error("Insert failed");
      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Failed to save review." });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
