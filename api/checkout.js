// api/checkout.js
// Creates a Stripe Checkout session for a $2 itinerary purchase (LIVE MODE)
// Required env vars: STRIPE_SECRET_KEY, VITE_STRIPE_PUBLISHABLE_KEY

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: "Missing Stripe secret key" });

  const { userId, email } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  // Use Stripe's REST API directly — no SDK needed
  const params = new URLSearchParams({
    "line_items[0][price]":    "price_1TfotW49tmrUaZplHvdB70vx",
    "line_items[0][quantity]": "1",
    "mode":                    "payment",
    "success_url":             "https://wayflo-bay.vercel.app/?payment=success&session_id={CHECKOUT_SESSION_ID}",
    "cancel_url":              "https://wayflo-bay.vercel.app/?payment=cancelled",
    "client_reference_id":     userId,
  });

  if (email) params.append("customer_email", email);

  try {
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const err = await stripeRes.json();
      console.error("Stripe error:", err);
      return res.status(502).json({ error: err.error?.message || "Stripe error" });
    }

    const session = await stripeRes.json();
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error("Checkout error:", e);
    return res.status(500).json({ error: "Could not create checkout session" });
  }
}
