// src/LandingPage.jsx
export default function LandingPage({ onGetStarted }) {
  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif", color:"var(--ink)", overflowX:"hidden" }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ minHeight:"92vh", display:"flex", flexDirection:"column", justifyContent:"center", padding:"4rem 1.5rem 3rem", maxWidth:720, margin:"0 auto", position:"relative" }}>

        {/* Decorative background text */}
        <div style={{ position:"absolute", top:"8%", right:"-2rem", fontFamily:"'Playfair Display', serif", fontSize:"clamp(6rem,18vw,14rem)", fontWeight:900, color:"rgba(196,98,45,0.06)", lineHeight:1, pointerEvents:"none", userSelect:"none", zIndex:0 }}>
          GO
        </div>

        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"999px", padding:"0.3rem 0.85rem", fontSize:"0.75rem", color:"var(--green)", fontWeight:500, marginBottom:"1.5rem" }}>
            ✦ First itinerary is free
          </div>

          <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(2.8rem,9vw,5.5rem)", fontWeight:900, lineHeight:1.0, marginBottom:"1.25rem", color:"var(--ink)" }}>
            Your next adventure,<br />
            <span style={{ color:"var(--rust)" }}>planned in seconds.</span>
          </h1>

          <p style={{ fontSize:"clamp(1rem,2.5vw,1.2rem)", color:"var(--warm-mid)", lineHeight:1.7, maxWidth:520, marginBottom:"2rem" }}>
            Wayflo builds day-by-day backpacker itineraries with real prices, maps, photos, and booking links — tailored to your budget and travel style.
          </p>

          <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={onGetStarted}
              style={{ padding:"0.9rem 2rem", background:"var(--rust)", border:"none", borderRadius:"10px", fontSize:"1rem", fontWeight:600, cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", transition:"background 0.2s, transform 0.15s", boxShadow:"0 4px 16px rgba(196,98,45,0.3)" }}
              onMouseOver={e=>{ e.currentTarget.style.background="var(--rust-dk)"; e.currentTarget.style.transform="translateY(-1px)"; }}
              onMouseOut={e=>{ e.currentTarget.style.background="var(--rust)"; e.currentTarget.style.transform="translateY(0)"; }}>
              Plan my trip →
            </button>
            <span style={{ fontSize:"0.82rem", color:"var(--warm-mid)" }}>No account needed to start</span>
          </div>

          {/* Stats row */}
          <div style={{ display:"flex", gap:"2rem", flexWrap:"wrap", marginTop:"3rem", paddingTop:"2rem", borderTop:"1px solid var(--sand)" }}>
            {[
              { number:"$2", label:"per itinerary after your first free one" },
              { number:"60s", label:"average generation time" },
              { number:"100+", label:"destinations covered" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"2rem", fontWeight:900, color:"var(--rust)", lineHeight:1 }}>{s.number}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--warm-mid)", marginTop:"0.25rem", maxWidth:140 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ background:"var(--white)", borderTop:"1px solid var(--sand)", borderBottom:"1px solid var(--sand)", padding:"4rem 1.5rem" }}>
        <div style={{ maxWidth:720, margin:"0 auto" }}>
          <div style={{ fontSize:"0.65rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>How it works</div>
          <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.8rem,5vw,2.8rem)", fontWeight:900, marginBottom:"2.5rem", color:"var(--ink)" }}>
            From zero to itinerary<br />in three steps.
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"1.5rem" }}>
            {[
              { step:"01", icon:"📝", title:"Answer 5 questions", desc:"Tell us where, when, how much, and what you love. Takes under a minute." },
              { step:"02", icon:"⚡", title:"AI builds your trip", desc:"We generate a full day-by-day plan with real places, prices, and transport options." },
              { step:"03", icon:"🗺️", title:"Explore and book", desc:"View your route on a map, see photos, and click through to book transport and hostels." },
            ].map(item => (
              <div key={item.step} style={{ background:"var(--paper)", borderRadius:"12px", padding:"1.5rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" }}>
                  <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.1rem", fontWeight:900, color:"var(--rust)" }}>{item.step}</span>
                  <span style={{ fontSize:"1.4rem" }}>{item.icon}</span>
                </div>
                <div style={{ fontWeight:600, fontSize:"0.95rem", marginBottom:"0.4rem", color:"var(--ink)" }}>{item.title}</div>
                <div style={{ fontSize:"0.82rem", color:"var(--warm-mid)", lineHeight:1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section style={{ padding:"4rem 1.5rem" }}>
        <div style={{ maxWidth:720, margin:"0 auto" }}>
          <div style={{ fontSize:"0.65rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>What you get</div>
          <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.8rem,5vw,2.8rem)", fontWeight:900, marginBottom:"2.5rem", color:"var(--ink)" }}>
            Not just a list of places.<br />
            <span style={{ color:"var(--rust)" }}>An actual plan.</span>
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"1rem" }}>
            {[
              { icon:"🗺️", title:"Interactive map", desc:"Every stop pinned on a live map. Click any location to see the day plan and navigate there." },
              { icon:"📸", title:"Destination photos", desc:"Real Unsplash photography for every leg of your journey, not stock illustrations." },
              { icon:"✈️", title:"Getting there & back", desc:"Full arrival and departure planning with transport options, realistic price ranges, and booking links." },
              { icon:"💰", title:"Budget-first planning", desc:"Every suggestion is calibrated to your total budget — flights, accommodation, food, and activities." },
              { icon:"✨", title:"Inspire Me", desc:"No idea where to go? Pick a vibe and we'll fill in everything — destination, dates, style, interests." },
              { icon:"💾", title:"Save and revisit", desc:"Create an account to save any trip and come back to it any time." },
            ].map(f => (
              <div key={f.title} style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"12px", padding:"1.25rem 1.4rem", display:"flex", gap:"0.85rem", alignItems:"flex-start" }}>
                <span style={{ fontSize:"1.4rem", flexShrink:0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight:600, fontSize:"0.9rem", marginBottom:"0.3rem", color:"var(--ink)" }}>{f.title}</div>
                  <div style={{ fontSize:"0.8rem", color:"var(--warm-mid)", lineHeight:1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR BACKPACKERS ─────────────────────────────────────────── */}
      <section style={{ background:"var(--ink)", padding:"4rem 1.5rem" }}>
        <div style={{ maxWidth:720, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"2rem", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:"0.65rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"rgba(255,255,255,0.4)", marginBottom:"0.5rem" }}>Built for</div>
            <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.8rem,5vw,2.5rem)", fontWeight:900, color:"#fff", lineHeight:1.1, marginBottom:"1rem" }}>
              The generation that travels differently.
            </h2>
            <p style={{ fontSize:"0.88rem", color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:"1.5rem" }}>
              Not package tours. Not five-star hotels. Real backpacker trips — hostels, street food, overnight buses, and the kind of experiences you actually tell people about when you get home.
            </p>
            <button onClick={onGetStarted}
              style={{ padding:"0.82rem 1.75rem", background:"var(--rust)", border:"none", borderRadius:"8px", fontSize:"0.92rem", fontWeight:600, cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", transition:"background 0.2s" }}
              onMouseOver={e=>e.currentTarget.style.background="var(--rust-dk)"}
              onMouseOut={e=>e.currentTarget.style.background="var(--rust)"}>
              Start planning free →
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            {[
              "✓  Day-by-day itineraries for 100+ destinations",
              "✓  Real hostel and transport recommendations",
              "✓  Budget breakdowns that don't lie",
              "✓  First trip completely free, $2 after that",
              "✓  No subscription, no commitment",
            ].map(line => (
              <div key={line} style={{ fontSize:"0.85rem", color:"rgba(255,255,255,0.75)", display:"flex", gap:"0.5rem" }}>{line}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section style={{ padding:"4rem 1.5rem", background:"var(--white)", borderTop:"1px solid var(--sand)" }}>
        <div style={{ maxWidth:480, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontSize:"0.65rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>Pricing</div>
          <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.8rem,5vw,2.5rem)", fontWeight:900, marginBottom:"0.75rem", color:"var(--ink)" }}>
            Simple and honest.
          </h2>
          <p style={{ fontSize:"0.88rem", color:"var(--warm-mid)", marginBottom:"2rem", lineHeight:1.6 }}>
            No subscriptions. No hidden fees. Pay only when you want a new itinerary.
          </p>
          <div style={{ background:"var(--paper)", border:"2px solid var(--rust)", borderRadius:"16px", padding:"2rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"3rem", fontWeight:900, color:"var(--rust)", lineHeight:1 }}>Free</div>
            <div style={{ fontSize:"0.85rem", color:"var(--warm-mid)", marginBottom:"1.25rem" }}>for your first itinerary</div>
            <div style={{ height:1, background:"var(--sand)", marginBottom:"1.25rem" }} />
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"2rem", fontWeight:900, color:"var(--ink)", lineHeight:1 }}>$2</div>
            <div style={{ fontSize:"0.85rem", color:"var(--warm-mid)", marginBottom:"1.5rem" }}>per itinerary after that</div>
            <button onClick={onGetStarted}
              style={{ width:"100%", padding:"0.85rem", background:"var(--rust)", border:"none", borderRadius:"8px", fontSize:"0.95rem", fontWeight:600, cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif" }}>
              Get started free →
            </button>
          </div>
          <div style={{ fontSize:"0.75rem", color:"var(--warm-mid)", lineHeight:1.6 }}>
            Secure payments via Stripe. No card required for your free trip.
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────────── */}
      <section style={{ padding:"5rem 1.5rem", textAlign:"center" }}>
        <div style={{ maxWidth:600, margin:"0 auto" }}>
          <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(2rem,6vw,3.5rem)", fontWeight:900, lineHeight:1.05, marginBottom:"1rem", color:"var(--ink)" }}>
            Where are you<br /><span style={{ color:"var(--rust)" }}>running off to?</span>
          </h2>
          <p style={{ fontSize:"0.9rem", color:"var(--warm-mid)", marginBottom:"2rem", lineHeight:1.6 }}>
            Your next adventure is five questions away.
          </p>
          <button onClick={onGetStarted}
            style={{ padding:"1rem 2.5rem", background:"var(--rust)", border:"none", borderRadius:"10px", fontSize:"1.05rem", fontWeight:600, cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", boxShadow:"0 4px 20px rgba(196,98,45,0.3)", transition:"background 0.2s, transform 0.15s" }}
            onMouseOver={e=>{ e.currentTarget.style.background="var(--rust-dk)"; e.currentTarget.style.transform="translateY(-2px)"; }}
            onMouseOut={e=>{ e.currentTarget.style.background="var(--rust)"; e.currentTarget.style.transform="translateY(0)"; }}>
            Plan my trip — it's free →
          </button>
        </div>
      </section>

    </div>
  );
}
