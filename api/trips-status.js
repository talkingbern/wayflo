// api/trips-status.js
// Returns the user's current trips_generated and paid_trips counts
// Called on login to initialize client state correctly
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Missing config" });

  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=trips_generated,paid_trips`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        }
      }
    );
    const profiles = await profileRes.json();
    const profile  = profiles?.[0];

    if (!profile) {
      // Create profile if missing
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
      return res.status(200).json({ trips_generated: 0, paid_trips: 0 });
    }

    return res.status(200).json({
      trips_generated: profile.trips_generated || 0,
      paid_trips: profile.paid_trips || 0,
    });
  } catch(e) {
    console.error("trips-status error:", e);
    return res.status(500).json({ error: "Could not fetch status" });
  }
}
