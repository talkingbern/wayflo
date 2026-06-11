// api/webhook.js
// Stripe webhook — credits paid_trips in Supabase when payment succeeds
// Set up in Stripe dashboard: Developers → Webhooks → Add endpoint
// URL: https://wayflo-bay.vercel.app/api/webhook
// Events: checkout.session.completed
export const config = {
  runtime: "nodejs",
  api: { bodyParser: false }, // Must be raw for Stripe signature verification
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripeSecret    = process.env.STRIPE_SECRET_KEY;
  const webhookSecret   = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl     = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecret || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Missing config" });
  }

  const rawBody = await getRawBody(req);
  const sig     = req.headers["stripe-signature"];

  // Verify webhook signature if secret is set
  let event;
  if (webhookSecret && sig) {
    try {
      // Manual HMAC verification without Stripe SDK
      const crypto    = await import("crypto");
      const parts     = sig.split(",").reduce((acc, part) => {
        const [k, v] = part.split("=");
        acc[k] = v;
        return acc;
      }, {});
      const timestamp = parts.t;
      const payload   = `${timestamp}.${rawBody.toString()}`;
      const expected  = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
      if (expected !== parts.v1) {
        console.error("Webhook signature mismatch");
        return res.status(400).json({ error: "Invalid signature" });
      }
    } catch(e) {
      console.error("Signature verification error:", e);
      return res.status(400).json({ error: "Signature error" });
    }
  }

  try {
    event = JSON.parse(rawBody.toString());
  } catch(e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId  = session.client_reference_id;

    if (userId) {
      try {
        // Get current paid_trips
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=paid_trips`,
          {
            headers: {
              "apikey": supabaseKey,
              "Authorization": `Bearer ${supabaseKey}`,
            }
          }
        );
        const profiles    = await profileRes.json();
        const currentPaid = profiles?.[0]?.paid_trips || 0;

        // Increment paid_trips by 1
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

        console.log(`Credited 1 paid trip to user ${userId}`);
      } catch(e) {
        console.error("Failed to credit paid trip:", e);
        return res.status(500).json({ error: "DB update failed" });
      }
    }
  }

  return res.status(200).json({ received: true });
}
