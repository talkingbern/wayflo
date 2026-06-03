import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";

// ─── Styles ───────────────────────────────────────────────────────────────────
const FONT_INJECT = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink:      #1a1510;
    --ink-soft: #4a3f34;
    --paper:    #f5f0e8;
    --sand:     #e0d5bf;
    --rust:     #c4622d;
    --rust-dk:  #9e4a1f;
    --warm-mid: #9a8870;
    --card-bg:  #faf7f2;
    --white:    #ffffff;
    --green:    #4a7c5e;
  }
  html { font-size: 16px; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }
  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 9999; opacity: 0.5;
  }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(196,98,45,0.4); }
    70%  { box-shadow: 0 0 0 10px rgba(196,98,45,0); }
    100% { box-shadow: 0 0 0 0 rgba(196,98,45,0); }
  }
`;

// ─── Data ─────────────────────────────────────────────────────────────────────
const DESTINATIONS = [
  "Bangkok, Thailand","Hanoi, Vietnam","Bali, Indonesia",
  "Medellín, Colombia","Lisbon, Portugal","Budapest, Hungary",
  "Marrakech, Morocco","Oaxaca, Mexico","Tbilisi, Georgia",
  "Chiang Mai, Thailand","Split, Croatia","Sarajevo, Bosnia",
];
const ORIGINS = [
  "New York, USA","London, UK","Sydney, Australia",
  "Toronto, Canada","Berlin, Germany","São Paulo, Brazil",
];
const STYLES   = ["Solo adventure","Group travel","Slow travel","Fast-paced explorer","Off the beaten path","Digital nomad"];
const INTERESTS_OPTIONS = [
  "Street food & markets","Hiking & nature","History & culture",
  "Nightlife","Art & architecture","Beaches","Photography","Volunteering",
];
const BUDGETS  = ["$300–500","$500–800","$800–1200","$1200–2000","$2000+"];

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDates() {
  const start = new Date(Date.now() + 864e5 * (Math.floor(Math.random() * 60) + 14));
  const end   = new Date(start.getTime() + 864e5 * (Math.floor(Math.random() * 18) + 5));
  return { from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) };
}

// ─── Shared input styles ──────────────────────────────────────────────────────
const inputBase = {
  width:"100%", padding:"0.7rem 1rem",
  background:"var(--white)", border:"1.5px solid var(--sand)",
  borderRadius:"8px", fontSize:"0.92rem", color:"var(--ink)",
  fontFamily:"'DM Sans', sans-serif", outline:"none",
  transition:"border-color 0.2s, box-shadow 0.2s",
};
function FocusInput({ as: Tag="input", style, children, ...props }) {
  const [f,setF] = useState(false);
  return <Tag {...props} style={{ ...inputBase, ...(f?{borderColor:"var(--rust)",boxShadow:"0 0 0 3px rgba(196,98,45,0.1)"}:{}), ...style }} onFocus={()=>setF(true)} onBlur={()=>setF(false)}>{children}</Tag>;
}
function SelectInput({ style, children, ...props }) {
  const [f,setF] = useState(false);
  return <select {...props} style={{ ...inputBase, appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239a8870' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"calc(100% - 14px) center", cursor:"pointer", ...(f?{borderColor:"var(--rust)",boxShadow:"0 0 0 3px rgba(196,98,45,0.1)"}:{}), ...style }} onFocus={()=>setF(true)} onBlur={()=>setF(false)}>{children}</select>;
}
function FieldRow({ number, label, onRandomize, children }) {
  return (
    <div style={{ marginBottom:"1.3rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.4rem" }}>
        <label style={{ fontSize:"0.63rem", fontWeight:600, letterSpacing:"0.13em", textTransform:"uppercase", color:"var(--warm-mid)" }}>
          {String(number).padStart(2,"0")} — {label}
        </label>
        {onRandomize && (
          <button type="button" onClick={onRandomize} title={`Randomize ${label}`}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:"0.75rem", color:"var(--warm-mid)", padding:"0 0.2rem", transition:"color 0.15s" }}
            onMouseOver={e=>e.currentTarget.style.color="var(--rust)"}
            onMouseOut={e=>e.currentTarget.style.color="var(--warm-mid)"}>🎲</button>
        )}
      </div>
      {children}
    </div>
  );
}
function Chip({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding:"0.35rem 0.8rem", borderRadius:"999px", border:"1.5px solid",
      borderColor: selected?"var(--rust)":"var(--sand)",
      background: selected?"var(--rust)":"transparent",
      color: selected?"#fff":"var(--warm-mid)",
      fontSize:"0.78rem", fontFamily:"'DM Sans', sans-serif",
      cursor:"pointer", transition:"all 0.15s", fontWeight: selected?500:400,
    }}>{label}</button>
  );
}
function Spinner({ size=14, color="#fff" }) {
  return <span style={{ width:size, height:size, borderRadius:"50%", border:`2px solid ${color}4`, borderTopColor:color, animation:"spin 0.7s linear infinite", display:"inline-block", flexShrink:0 }} />;
}
function DayCard({ day, index }) {
  const bullets = day.content.split("\n").map(l=>l.replace(/^[•\-\*]\s*/,"").trim()).filter(Boolean);
  return (
    <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"10px", padding:"1.1rem 1.3rem", animation:"fadeUp 0.35s ease both", animationDelay:`${index*0.05}s` }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:"0.6rem", marginBottom:"0.7rem" }}>
        <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.3rem", fontWeight:900, color:"var(--rust)", flexShrink:0 }}>{String(index+1).padStart(2,"0")}</span>
        <span style={{ fontWeight:600, fontSize:"0.92rem", color:"var(--ink)" }}>{day.title.replace(/^Day \d+\s*[—-]\s*/,"")}</span>
      </div>
      <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
        {bullets.map((b,i)=>(
          <li key={i} style={{ display:"flex", gap:"0.5rem", fontSize:"0.84rem", lineHeight:1.5, color:"var(--ink-soft)" }}>
            <span style={{ color:"var(--rust)", flexShrink:0, marginTop:"0.05rem" }}>→</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function HeroPhoto({ query, destination }) {
  const [loaded,setLoaded] = useState(false);
  const [errored,setErrored] = useState(false);
  const url = `https://source.unsplash.com/featured/1200x500?${encodeURIComponent(query||destination)}`;
  if (errored) return null;
  return (
    <div style={{ width:"100%", height:"220px", borderRadius:"12px", overflow:"hidden", background:"var(--sand)", marginBottom:"1.5rem", position:"relative" }}>
      {!loaded && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={22} color="var(--warm-mid)" /></div>}
      <img src={url} alt={destination} onLoad={()=>setLoaded(true)} onError={()=>setErrored(true)}
        style={{ width:"100%", height:"100%", objectFit:"cover", opacity:loaded?1:0, transition:"opacity 0.4s" }} />
      {loaded && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top, rgba(26,21,16,0.55), transparent)", padding:"1.5rem 1.2rem 0.7rem" }}>
          <span style={{ fontSize:"0.65rem", color:"rgba(255,255,255,0.7)", letterSpacing:"0.08em" }}>Photo via Unsplash</span>
        </div>
      )}
    </div>
  );
}

// ─── Paywall banner ───────────────────────────────────────────────────────────
function PaywallBanner({ onSignIn, onPay, user }) {
  return (
    <div style={{ background:"var(--white)", border:"2px solid var(--rust)", borderRadius:"12px", padding:"1.5rem", textAlign:"center", marginBottom:"1.5rem", animation:"fadeUp 0.3s ease both" }}>
      <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.2rem", fontWeight:900, marginBottom:"0.4rem" }}>Your free trip is used up</div>
      <p style={{ fontSize:"0.85rem", color:"var(--warm-mid)", lineHeight:1.6, marginBottom:"1rem" }}>
        Each new itinerary is $5 — one flat fee, no subscription.
      </p>
      {!user ? (
        <button onClick={onSignIn} style={{ padding:"0.72rem 1.5rem", background:"var(--rust)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"0.9rem", fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
          Sign in to continue →
        </button>
      ) : (
        <button onClick={onPay} style={{ padding:"0.72rem 1.5rem", background:"var(--rust)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"0.9rem", fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
          Pay $5 and generate →
        </button>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [user, setUser]           = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuth, setShowAuth]   = useState(false);
  const [tripCount, setTripCount] = useState(0); // trips generated this session

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    // Listen for sign in / sign out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setTripCount(0);
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  const [destination, setDestination]       = useState("");
  const [origin, setOrigin]                 = useState("");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [budget, setBudget]                 = useState("");
  const [travelStyle, setTravelStyle]       = useState("");
  const [interests, setInterests]           = useState([]);
  const [customInterest, setCustomInterest] = useState("");

  // ── App state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState("form");
  const [itinerary, setItinerary]   = useState(null);
  const [rawText, setRawText]       = useState("");
  const [photoQuery, setPhotoQuery] = useState("");
  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining]     = useState(false);
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const requestInFlight             = useRef(false);

  // ── Free trip gate ─────────────────────────────────────────────────────────
  // Payment state
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paidTrips, setPaidTrips]         = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      setPaymentStatus("success");
      setPaidTrips(n => n + 1);
      window.history.replaceState({}, "", "/");
    } else if (payment === "cancelled") {
      setPaymentStatus("cancelled");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Free trip gate
  const hasFreeTripAvailable = tripCount === 0;
  const hasPaidTripAvailable = user && paidTrips > 0;
  const canGenerate          = hasFreeTripAvailable || hasPaidTripAvailable;
  const isBlocked            = !canGenerate;

  async function startCheckout() {
    if (!user) { setShowAuth(true); return; }
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      if (!res.ok) throw new Error("Could not start checkout");
      const { url } = await res.json();
      window.location.href = url;
    } catch(e) {
      setError(e.message || "Payment failed. Try again.");
    }
  }

    setInterests(prev => prev.includes(item) ? prev.filter(i=>i!==item) : [...prev,item]);
  }
  function addCustomInterest() {
    const val = customInterest.trim();
    if (val && !interests.includes(val)) setInterests(prev=>[...prev,val]);
    setCustomInterest("");
  }
  function randomizeAll() {
    const { from, to } = randomDates();
    setDestination(randomPick(DESTINATIONS)); setOrigin(randomPick(ORIGINS));
    setDateFrom(from); setDateTo(to);
    setBudget(randomPick(BUDGETS)); setTravelStyle(randomPick(STYLES));
    const shuffled = [...INTERESTS_OPTIONS].sort(()=>Math.random()-0.5);
    setInterests(shuffled.slice(0, Math.floor(Math.random()*2)+2));
  }
  function parseItinerary(text) {
    try { return JSON.parse(text.replace(/```json|```/g,"").trim()); }
    catch { return { intro:"", photoQuery:"", days:[{ title:"Your Itinerary", content:text }] }; }
  }
  async function callEndpoint(body) {
    const res = await fetch("/api/generate", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`Request failed (${res.status})`); }
    return (await res.json()).raw;
  }

  async function generate() {
    if (!destination||!dateFrom||!dateTo||!budget||!travelStyle) { setError("Please fill in all fields."); return; }
    if (isBlocked) { if (!user) setShowAuth(true); else startCheckout(); return; }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(""); setPhase("loading");
    try {
      const text   = await callEndpoint({ destination, origin, dateFrom, dateTo, budget, travelStyle, interests });
      const parsed = parseItinerary(text);
      setRawText(text); setItinerary(parsed);
      setPhotoQuery(parsed.photoQuery || destination);
      setTripCount(c => c + 1);
      setSaved(false);
      setPhase("result");
    } catch(e) {
      setError(e.message||"Something went wrong."); setPhase("form");
    } finally { requestInFlight.current = false; }
  }

  async function refine() {
    if (!refineFeedback.trim()||requestInFlight.current) return;
    if (isBlocked) { if (!user) setShowAuth(true); else startCheckout(); return; }
    requestInFlight.current = true;
    setRefining(true); setError("");
    try {
      const text   = await callEndpoint({ destination, origin, dateFrom, dateTo, budget, travelStyle, interests, refineFeedback, previousItinerary:rawText });
      const parsed = parseItinerary(text);
      setRawText(text); setItinerary(parsed);
      setPhotoQuery(parsed.photoQuery || destination);
      setRefineFeedback("");
    } catch(e) { setError(e.message||"Refinement failed."); }
    finally { setRefining(false); requestInFlight.current = false; }
  }

  async function saveTrip() {
    if (!user) { setShowAuth(true); return; }
    if (saving || saved) return;
    setSaving(true);
    const { error } = await supabase.from("trips").insert({
      user_id:      user.id,
      destination,
      date_from:    dateFrom || null,
      date_to:      dateTo   || null,
      budget,
      travel_style: travelStyle,
      origin,
      interests,
      itinerary,
    });
    if (error) {
      setError(`Couldn't save trip. Try again.`);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  const busy = phase === "loading";

  if (!authReady) return null; // wait for session check before rendering

  return (
    <>
      <style>{FONT_INJECT}</style>

      {/* Auth modal */}
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}

      {/* Header */}
      <header style={{ maxWidth:680, margin:"0 auto", padding:"1.4rem 1.25rem 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        {/* Logo + tagline stacked */}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.1rem" }}>
          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.55rem", fontWeight:900, color:"var(--rust)", lineHeight:1 }}>Wayflo</span>
          <span style={{ fontSize:"0.62rem", letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)" }}>Budget travel planner</span>
        </div>
        {/* Right side controls */}
        <div style={{ display:"flex", alignItems:"center", gap:"0.65rem" }}>
          {phase === "result" && (
            <button onClick={()=>{ setPhase("form"); setItinerary(null); setError(""); }}
              style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.35rem 0.85rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>
              ← New trip
            </button>
          )}
          {user ? (
            <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
              <span style={{ fontSize:"0.73rem", color:"var(--warm-mid)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</span>
              <button onClick={signOut}
                style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.35rem 0.85rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap" }}>
                Sign out
              </button>
            </div>
          ) : (
            <button onClick={()=>setShowAuth(true)}
              style={{ background:"var(--rust)", border:"none", borderRadius:"6px", padding:"0.38rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", fontWeight:500, whiteSpace:"nowrap" }}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth:680, margin:"0 auto", padding:"1.25rem" }}>

        {/* Free trip badge */}
        {!user && tripCount === 0 && phase === "form" && (
          <div style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"999px", padding:"0.3rem 0.8rem", fontSize:"0.75rem", color:"var(--green)", fontWeight:500, marginBottom:"1rem" }}>
            ✦ First itinerary is free — no account needed
          </div>
        )}
        {paymentStatus === "success" && phase === "form" && (
          <div style={{ background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.82rem", color:"var(--green)", marginBottom:"1rem", fontWeight:500 }}>
            ✔ Payment successful — your trip is ready to generate!
          </div>
        )}
        {paymentStatus === "cancelled" && phase === "form" && (
          <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>
            Payment cancelled — no charge was made.
          </div>
        )}

        {/* ── FORM ───────────────────────────────────────────────────────── */}
        {phase === "form" && (
          <div style={{ animation:"fadeUp 0.4s ease both" }}>
            <div style={{ marginBottom:"1.75rem" }}>
              <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.9rem,7vw,2.9rem)", fontWeight:900, lineHeight:1.1, marginBottom:"0.5rem", color:"var(--ink)" }}>
                <span style={{ color:"var(--ink)" }}>Where are you</span><br /><span style={{ color:"var(--rust)" }}>running off to?</span>
              </h1>
              <p style={{ fontSize:"0.87rem", color:"var(--warm-mid)", lineHeight:1.6 }}>Five questions. One perfect backpacker itinerary.</p>
            </div>

            <div style={{ height:1, background:"var(--sand)", marginBottom:"1.6rem" }} />

            {isBlocked && <PaywallBanner onSignIn={()=>setShowAuth(true)} onPay={startCheckout} user={user} />}

            <FieldRow number={1} label="Destination" onRandomize={()=>setDestination(randomPick(DESTINATIONS))}>
              <FocusInput type="text" placeholder="e.g. Hanoi, Vietnam or Southeast Asia" value={destination} onChange={e=>setDestination(e.target.value)} />
            </FieldRow>
            <FieldRow number={2} label="Travelling from" onRandomize={()=>setOrigin(randomPick(ORIGINS))}>
              <FocusInput type="text" placeholder="Your departure city, e.g. New York" value={origin} onChange={e=>setOrigin(e.target.value)} />
            </FieldRow>
            <FieldRow number={3} label="Travel Dates" onRandomize={()=>{ const d=randomDates(); setDateFrom(d.from); setDateTo(d.to); }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.65rem" }}>
                <div><div style={{ fontSize:"0.7rem", color:"var(--warm-mid)", marginBottom:"0.25rem" }}>From</div>
                  <FocusInput type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /></div>
                <div><div style={{ fontSize:"0.7rem", color:"var(--warm-mid)", marginBottom:"0.25rem" }}>To</div>
                  <FocusInput type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /></div>
              </div>
            </FieldRow>
            <FieldRow number={4} label="Total Trip Budget" onRandomize={()=>setBudget(randomPick(BUDGETS))}>
              <SelectInput value={budget} onChange={e=>setBudget(e.target.value)}>
                <option value="">Select your total budget (flights + stay + food)</option>
                {BUDGETS.map(b=><option key={b}>{b}</option>)}
              </SelectInput>
            </FieldRow>
            <FieldRow number={5} label="Travel Style" onRandomize={()=>setTravelStyle(randomPick(STYLES))}>
              <SelectInput value={travelStyle} onChange={e=>setTravelStyle(e.target.value)}>
                <option value="">How do you like to travel?</option>
                {STYLES.map(s=><option key={s}>{s}</option>)}
              </SelectInput>
            </FieldRow>
            <FieldRow number={6} label="Interests" onRandomize={()=>{ const s=[...INTERESTS_OPTIONS].sort(()=>Math.random()-0.5); setInterests(s.slice(0,Math.floor(Math.random()*2)+2)); }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"0.45rem", marginBottom:"0.65rem" }}>
                {INTERESTS_OPTIONS.map(item=><Chip key={item} label={item} selected={interests.includes(item)} onClick={()=>toggleInterest(item)} />)}
                {interests.filter(i=>!INTERESTS_OPTIONS.includes(i)).map(i=><Chip key={i} label={i} selected={true} onClick={()=>toggleInterest(i)} />)}
              </div>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                <FocusInput type="text" placeholder="Add your own interest…" value={customInterest}
                  onChange={e=>setCustomInterest(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addCustomInterest()} style={{ flex:1 }} />
                <button type="button" onClick={addCustomInterest} disabled={!customInterest.trim()}
                  style={{ padding:"0 1rem", background:customInterest.trim()?"var(--rust)":"var(--sand)", border:"none", borderRadius:"8px", color:customInterest.trim()?"#fff":"var(--warm-mid)", fontSize:"0.85rem", cursor:customInterest.trim()?"pointer":"not-allowed", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap", transition:"background 0.15s" }}>
                  + Add
                </button>
              </div>
            </FieldRow>

            {error && <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>{error}</div>}

            <div style={{ display:"flex", gap:"0.65rem", flexWrap:"wrap" }}>
              <button onClick={randomizeAll} disabled={busy}
                style={{ padding:"0.72rem 1.2rem", background:"transparent", border:"1.5px solid var(--sand)", borderRadius:"8px", fontSize:"0.86rem", cursor:busy?"not-allowed":"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif", opacity:busy?0.5:1, transition:"border-color 0.15s, color 0.15s" }}
                onMouseOver={e=>{ if(!busy){e.currentTarget.style.borderColor="var(--rust)";e.currentTarget.style.color="var(--rust)";} }}
                onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--sand)";e.currentTarget.style.color="var(--warm-mid)"; }}>
                🎲 Randomize all
              </button>
              <button onClick={generate} disabled={busy}
                style={{ flex:"1 1 180px", padding:"0.72rem 1.5rem", background:busy?"var(--warm-mid)":"var(--rust)", border:"none", borderRadius:"8px", fontSize:"0.93rem", fontWeight:500, cursor:busy?"not-allowed":"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", animation:busy?"none":"pulse-ring 2.5s infinite", transition:"background 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                {busy ? <><Spinner />Generating…</> : "Generate my itinerary →"}
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ─────────────────────────────────────────────────────── */}
        {phase === "loading" && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"65vh", gap:"1.2rem", animation:"fadeIn 0.3s ease both" }}>
            <div style={{ width:44, height:44, borderRadius:"50%", border:"3px solid var(--sand)", borderTopColor:"var(--rust)", animation:"spin 0.8s linear infinite" }} />
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.35rem", fontWeight:700, marginBottom:"0.3rem" }}>Plotting your adventure…</div>
              <div style={{ fontSize:"0.82rem", color:"var(--warm-mid)" }}>Finding hidden gems, local spots, and the best routes.</div>
            </div>
          </div>
        )}

        {/* ── RESULT ──────────────────────────────────────────────────────── */}
        {phase === "result" && itinerary && (
          <div style={{ animation:"fadeUp 0.4s ease both" }}>
            <HeroPhoto query={photoQuery} destination={destination} />
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.35rem" }}>Your itinerary</div>
              <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.4rem,5vw,2rem)", fontWeight:900, color:"var(--ink)", lineHeight:1.15, marginBottom:"0.65rem" }}>{destination}</h2>
              {itinerary.intro && <p style={{ fontSize:"0.88rem", lineHeight:1.7, color:"var(--ink-soft)" }}>{itinerary.intro}</p>}
              <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap", marginTop:"0.8rem" }}>
                {[origin&&`From ${origin}`, dateFrom&&`${dateFrom} → ${dateTo}`, budget, travelStyle].filter(Boolean).map(tag=>(
                  <span key={tag} style={{ padding:"0.22rem 0.65rem", background:"var(--sand)", borderRadius:"999px", fontSize:"0.72rem", color:"var(--ink)", fontWeight:500 }}>{tag}</span>
                ))}
              </div>
            </div>

            <div style={{ height:1, background:"var(--sand)", marginBottom:"1.25rem" }} />

            <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem", marginBottom:"1.75rem" }}>
              {itinerary.days.map((day,i)=><DayCard key={i} day={day} index={i} />)}
            </div>

            <button
              onClick={saveTrip}
              disabled={saving || saved}
              style={{ width:"100%", padding:"0.82rem", background: saved ? "var(--green)" : saving ? "var(--warm-mid)" : "var(--ink)", border:"none", borderRadius:"8px", color:"var(--paper)", fontSize:"0.92rem", fontWeight:500, cursor: saved||saving ? "default" : "pointer", fontFamily:"'DM Sans', sans-serif", marginBottom:"0.85rem", transition:"background 0.3s", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
              {saved ? "✓ Trip saved" : saving ? <><Spinner />Saving…</> : "Save this trip"}
            </button>

            {/* Refine */}
            <div style={{ background:"var(--card-bg)", border:"1px solid var(--sand)", borderRadius:"10px", padding:"1.15rem" }}>
              <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.45rem" }}>Refine</div>
              <p style={{ fontSize:"0.8rem", color:"var(--warm-mid)", marginBottom:"0.8rem", lineHeight:1.5 }}>Not quite right? Tell us what to tweak.</p>
              <FocusInput as="textarea" placeholder="e.g. More beach time, skip museums, I hate early mornings…"
                value={refineFeedback} onChange={e=>setRefineFeedback(e.target.value)}
                disabled={refining} rows={3}
                style={{ resize:"vertical", marginBottom:"0.65rem", lineHeight:1.6, fontSize:"0.86rem", opacity:refining?0.6:1 }} />
              {error && <div style={{ fontSize:"0.78rem", color:"var(--rust-dk)", marginBottom:"0.5rem" }}>{error}</div>}
              <button onClick={refine} disabled={refining||!refineFeedback.trim()}
                style={{ width:"100%", padding:"0.72rem", background:(refining||!refineFeedback.trim())?"var(--sand)":"var(--rust)", border:"none", borderRadius:"7px", color:(refining||!refineFeedback.trim())?"var(--warm-mid)":"#fff", fontSize:"0.88rem", fontWeight:500, cursor:(refining||!refineFeedback.trim())?"not-allowed":"pointer", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem", transition:"background 0.2s" }}>
                {refining ? <><Spinner />Regenerating…</> : "↻ Regenerate itinerary"}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={{ textAlign:"center", padding:"2rem 1rem 1.5rem", color:"var(--warm-mid)", fontSize:"0.68rem", letterSpacing:"0.06em" }}>
        WAYFLO · First trip free · $5/trip after that
      </footer>
    </>
  );
}
