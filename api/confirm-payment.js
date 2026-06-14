// api/confirm-payment.js
// Called client-side after Stripe redirects back with ?payment=success
// Verifies the payment with Stripe and credits paid_trips in Supabase
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey   = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Missing config" });
  }

  const { sessionId, userId } = req.body ?? {};
  if (!sessionId || !userId) return res.status(400).json({ error: "Missing sessionId or userId" });

  // Verify the session with Stripe
  let session;
  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { "Authorization": `Bearer ${stripeKey}` },
    });
    if (!stripeRes.ok) throw new Error("Stripe fetch failed: " + stripeRes.status);
    session = await stripeRes.json();
  } catch(e) {
    console.error("Stripe verify error:", e);
    return res.status(502).json({ error: "Could not verify payment" });
  }

  // Check payment was actually completed and belongs to this user
  if (session.payment_status !== "paid") {
    return res.status(400).json({ error: "Payment not completed" });
  }
  if (session.client_reference_id !== userId) {
    return res.status(403).json({ error: "User mismatch" });
  }

  // Credit paid_trips in Supabase
  try {
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=paid_trips`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Accept": "application/json",
        }
      }
    );
    const profiles    = await profileRes.json();
    const currentPaid = profiles?.[0]?.paid_trips || 0;

    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ paid_trips: currentPaid + 1 }),
    });

    console.log(`Credited paid trip to user ${userId}, now has ${currentPaid + 1}`);
    return res.status(200).json({ success: true, paid_trips: currentPaid + 1 });
  } catch(e) {
    console.error("DB credit error:", e);
    return res.status(500).json({ error: "Could not credit payment" });
  }
}
