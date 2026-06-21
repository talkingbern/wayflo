// api/notes.js
export const config = { runtime: "nodejs" };

const NEARBY_RADIUS_METERS = 150;

function normalizeLocationName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function boundingBox(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  return {
    minLat: lat - latDelta, maxLat: lat + latDelta,
    minLng: lng - lngDelta, maxLng: lng + lngDelta,
  };
}

// Crude similarity: 2 = exact normalized match, 1 = substring overlap, 0 = nearby only
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (a.includes(b) || b.includes(a)) return 1;
  return 0;
}

const VALID_CATEGORIES = ["closed", "price_change", "safety", "tip", "other"];
const VALID_VOTES      = ["helpful", "outdated"];

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Missing Supabase config." });

  const sbHeaders = {
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };

  // ── GET: fetch notes near a lat/lng, ranked by name similarity ───────────
  if (req.method === "GET") {
    const { lat, lng, locationName } = req.query;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: "lat and lng are required." });
    }

    const box = boundingBox(latNum, lngNum, NEARBY_RADIUS_METERS);
    const targetNormalized = normalizeLocationName(locationName);

    try {
      const url = `${supabaseUrl}/rest/v1/location_notes?` +
        `lat=gte.${box.minLat}&lat=lte.${box.maxLat}&` +
        `lng=gte.${box.minLng}&lng=lte.${box.maxLng}&` +
        `select=*&order=created_at.desc`;
      const r = await fetch(url, { headers: { ...sbHeaders, "Accept": "application/json" } });
      if (!r.ok) throw new Error(await r.text());
      let notes = await r.json();

      // Drop notes the community has flagged as outdated
      notes = notes.filter(n => !(n.outdated_count >= 3 && n.outdated_count > n.helpful_count));

      // Rank: name match first (exact > partial > nearby-only), then by helpful votes within each tier
      notes.sort((a, b) => {
        const simA = nameSimilarity(targetNormalized, a.location_name_normalized);
        const simB = nameSimilarity(targetNormalized, b.location_name_normalized);
        if (simB !== simA) return simB - simA;
        return (b.helpful_count - b.outdated_count) - (a.helpful_count - a.outdated_count);
      });

      // Cap at 3 — best-ranked notes only, keeps the UI compact
      notes = notes.slice(0, 3);

      return res.status(200).json({ notes });
    } catch(e) {
      console.error("notes GET failed:", e.message);
      return res.status(502).json({ error: "Could not fetch notes." });
    }
  }

  // ── POST: create a new note ───────────────────────────────────────────────
  if (req.method === "POST") {
    const { userId, locationName, destination, lat, lng, category, body } = req.body ?? {};
    if (!userId || !locationName || !destination || lat == null || lng == null || !body?.trim()) {
      return res.status(400).json({ error: "Missing required fields." });
    }
    const safeCategory = VALID_CATEGORIES.includes(category) ? category : "tip";
    if (body.length > 500) return res.status(400).json({ error: "Note is too long (500 char max)." });

    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/location_notes`, {
        method: "POST",
        headers: { ...sbHeaders, "Prefer": "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          location_name: locationName,
          location_name_normalized: normalizeLocationName(locationName),
          destination,
          lat, lng,
          category: safeCategory,
          body: body.trim(),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const [created] = await r.json();
      return res.status(200).json({ note: created });
    } catch(e) {
      console.error("notes POST failed:", e.message);
      return res.status(502).json({ error: "Could not create note." });
    }
  }

  // ── PATCH: vote on a note (helpful / outdated), allows changing a vote ────
  if (req.method === "PATCH") {
    const { userId, noteId, vote } = req.body ?? {};
    if (!userId || !noteId || !VALID_VOTES.includes(vote)) {
      return res.status(400).json({ error: "Missing or invalid fields." });
    }

    try {
      // Check for an existing vote from this user on this note
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/location_note_votes?note_id=eq.${noteId}&user_id=eq.${userId}&select=vote`,
        { headers: { ...sbHeaders, "Accept": "application/json" } }
      );
      if (!existingRes.ok) throw new Error(await existingRes.text());
      const existing = await existingRes.json();
      const previousVote = existing?.[0]?.vote;

      if (previousVote === vote) {
        // Same vote again — no-op, nothing changes
        return res.status(200).json({ ok: true, changed: false });
      }

      if (previousVote) {
        // Switching vote: update the row, decrement old counter, increment new one
        await fetch(`${supabaseUrl}/rest/v1/location_note_votes?note_id=eq.${noteId}&user_id=eq.${userId}`, {
          method: "PATCH",
          headers: { ...sbHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify({ vote }),
        });
        const oldColumn = previousVote === "helpful" ? "helpful_count" : "outdated_count";
        const newColumn = vote === "helpful" ? "helpful_count" : "outdated_count";
        await fetch(`${supabaseUrl}/rest/v1/rpc/decrement_note_count`, {
          method: "POST", headers: sbHeaders,
          body: JSON.stringify({ note_id: noteId, column_name: oldColumn }),
        });
        await fetch(`${supabaseUrl}/rest/v1/rpc/increment_note_count`, {
          method: "POST", headers: sbHeaders,
          body: JSON.stringify({ note_id: noteId, column_name: newColumn }),
        });
      } else {
        // First vote from this user
        await fetch(`${supabaseUrl}/rest/v1/location_note_votes`, {
          method: "POST",
          headers: { ...sbHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify({ note_id: noteId, user_id: userId, vote }),
        });
        const column = vote === "helpful" ? "helpful_count" : "outdated_count";
        await fetch(`${supabaseUrl}/rest/v1/rpc/increment_note_count`, {
          method: "POST", headers: sbHeaders,
          body: JSON.stringify({ note_id: noteId, column_name: column }),
        });
      }

      return res.status(200).json({ ok: true, changed: true });
    } catch(e) {
      console.error("notes PATCH failed:", e.message);
      return res.status(502).json({ error: "Could not record vote." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
