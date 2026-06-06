import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import TripHistory from "./TripHistory";

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
  body { background: var(--paper); color: var(--ink); font-family: 'DM Sans', sans-serif; min-height: 100vh; overflow-x: hidden; }
  body::before {
    content: ''; position: fixed; inset: 0;
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
  @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
`;

// ── Trip vibes for Inspire Me ─────────────────────────────────────────────────
const VIBES = [
  { id:"adventure", label:"Adventure", icon:"🏔️", desc:"Hiking, wild camping, off-grid" },
  { id:"culture",   label:"Culture",   icon:"🏛️", desc:"History, art, local life" },
  { id:"beach",     label:"Beach",     icon:"🏖️", desc:"Sun, sea, slow days" },
  { id:"party",     label:"Nightlife", icon:"🎉", desc:"Music, bars, new friends" },
  { id:"food",      label:"Food",      icon:"🍜", desc:"Markets, street food, flavour" },
  { id:"offgrid",   label:"Off-grid",  icon:"🌿", desc:"Remote, quiet, untouristed" },
];

const STYLES = ["Solo adventure","Group travel","Slow travel","Fast-paced explorer","Off the beaten path","Digital nomad"];
const INTERESTS_OPTIONS = ["Street food & markets","Hiking & nature","History & culture","Nightlife","Art & architecture","Beaches","Photography","Volunteering"];
const BUDGETS = ["$300-500","$500-800","$800-1200","$1200-2000","$2000+"];

function randomDates() {
  const start = new Date(Date.now() + 864e5 * (Math.floor(Math.random() * 60) + 14));
  const end   = new Date(start.getTime() + 864e5 * (Math.floor(Math.random() * 18) + 5));
  return { from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) };
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputBase = {
  width:"100%", padding:"0.75rem 1rem",
  background:"var(--white)", border:"1.5px solid var(--sand)",
  borderRadius:"8px", fontSize:"0.92rem", color:"var(--ink)",
  fontFamily:"'DM Sans', sans-serif", outline:"none",
  transition:"border-color 0.2s, box-shadow 0.2s",
};

function FocusInput({ as: Tag="input", style, children, ...props }) {
  const [f,setF] = useState(false);
  return (
    <Tag {...props}
      style={{ ...inputBase, ...(f ? { borderColor:"var(--rust)", boxShadow:"0 0 0 3px rgba(196,98,45,0.1)" } : {}), ...style }}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}>
      {children}
    </Tag>
  );
}

function SelectInput({ style, children, ...props }) {
  const [f,setF] = useState(false);
  return (
    <select {...props}
      style={{ ...inputBase, appearance:"none", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239a8870' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"calc(100% - 14px) center", cursor:"pointer", ...(f ? { borderColor:"var(--rust)", boxShadow:"0 0 0 3px rgba(196,98,45,0.1)" } : {}), ...style }}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}>
      {children}
    </select>
  );
}

function Spinner({ size=14, color="#fff" }) {
  return <span style={{ width:size, height:size, borderRadius:"50%", border:"2px solid "+color+"4", borderTopColor:color, animation:"spin 0.7s linear infinite", display:"inline-block", flexShrink:0 }} />;
}

function Chip({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ padding:"0.35rem 0.8rem", borderRadius:"999px", border:"1.5px solid", borderColor:selected?"var(--rust)":"var(--sand)", background:selected?"var(--rust)":"transparent", color:selected?"#fff":"var(--warm-mid)", fontSize:"0.78rem", fontFamily:"'DM Sans', sans-serif", cursor:"pointer", transition:"all 0.15s", fontWeight:selected?500:400 }}>
      {label}
    </button>
  );
}

// ── Field card — wraps each question ──────────────────────────────────────────
function FieldCard({ number, icon, label, hint, children, action }) {
  return (
    <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"12px", padding:"1.1rem 1.25rem", marginBottom:"0.85rem" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"0.65rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
          <span style={{ fontSize:"1.1rem", lineHeight:1 }}>{icon}</span>
          <div>
            <div style={{ fontSize:"0.62rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", lineHeight:1 }}>
              {String(number).padStart(2,"0")} — {label}
            </div>
            {hint && <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginTop:"0.2rem", opacity:0.8 }}>{hint}</div>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Random dice button ────────────────────────────────────────────────────────
function DiceBtn({ onClick, title }) {
  const [hov,setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ background:hov?"var(--sand)":"transparent", border:"1px solid var(--sand)", borderRadius:"6px", padding:"0.25rem 0.5rem", cursor:"pointer", fontSize:"0.9rem", transition:"background 0.15s", lineHeight:1, flexShrink:0 }}
      onMouseOver={()=>setHov(true)} onMouseOut={()=>setHov(false)}>
      🎲
    </button>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────
function DayCard({ day, index, displayNumber }) {
  const bullets = day.content.split("\n").map(l => l.replace(/^[*\-•] ?/, "").trim()).filter(Boolean);
  const cleanTitle = day.title.replace(/^Day \d+\s*[-—]\s*/, "");
  return (
    <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"10px", padding:"1.1rem 1.3rem", animation:"fadeUp 0.35s ease both", animationDelay:index*0.05+"s" }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:"0.6rem", marginBottom:"0.7rem" }}>
        <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.3rem", fontWeight:900, color:"var(--rust)", flexShrink:0 }}>
          {displayNumber}
        </span>
        <span style={{ fontWeight:600, fontSize:"0.92rem", color:"var(--ink)" }}>{cleanTitle}</span>
      </div>
      <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
        {bullets.map((b,i) => (
          <li key={i} style={{ display:"flex", gap:"0.5rem", fontSize:"0.84rem", lineHeight:1.5, color:"var(--ink-soft)" }}>
            <span style={{ color:"var(--rust)", flexShrink:0 }}>→</span>
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
  const url = "https://source.unsplash.com/featured/1200x500?"+encodeURIComponent(query||destination);
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

function PaywallBanner({ onSignIn, onPay, user }) {
  return (
    <div style={{ background:"var(--white)", border:"2px solid var(--rust)", borderRadius:"12px", padding:"1.5rem", textAlign:"center", marginBottom:"1.5rem", animation:"fadeUp 0.3s ease both" }}>
      <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.2rem", fontWeight:900, marginBottom:"0.4rem" }}>Your free trip is used up</div>
      <p style={{ fontSize:"0.85rem", color:"var(--warm-mid)", lineHeight:1.6, marginBottom:"1rem" }}>Each new itinerary is $5 — one flat fee, no subscription.</p>
      {!user ? (
        <button onClick={onSignIn} style={{ padding:"0.72rem 1.5rem", background:"var(--rust)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"0.9rem", fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Sign in to continue</button>
      ) : (
        <button onClick={onPay} style={{ padding:"0.72rem 1.5rem", background:"var(--rust)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"0.9rem", fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Pay $5 and generate</button>
      )}
    </div>
  );
}

// ── Inspire Me modal ──────────────────────────────────────────────────────────
function InspireModal({ onClose, onFill }) {
  const [vibe, setVibe]       = useState("");
  const [duration, setDuration] = useState("");
  const [budget, setBudget]   = useState("");
  const [origin, setOrigin]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function inspire() {
    if (!vibe) { setError("Pick a vibe first."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:500,
          messages:[{
            role:"user",
            content:`Suggest a perfect backpacker trip for someone who wants a ${vibe} vibe.
${duration ? "Trip length: "+duration : ""}
${budget ? "Budget: "+budget : ""}
${origin ? "Travelling from: "+origin : ""}

Reply ONLY with a JSON object, no markdown:
{
  "destination": "City, Country",
  "dateFrom": "YYYY-MM-DD",
  "dateTo": "YYYY-MM-DD",
  "budget": "one of: $300-500 / $500-800 / $800-1200 / $1200-2000 / $2000+",
  "travelStyle": "one of: Solo adventure / Group travel / Slow travel / Fast-paced explorer / Off the beaten path / Digital nomad",
  "interests": ["up to 3 from: Street food & markets, Hiking & nature, History & culture, Nightlife, Art & architecture, Beaches, Photography, Volunteering"]
}`
          }]
        })
      });
      const data = await res.json();
      const text = (data.content||[]).map(b=>b.text||"").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      onFill({ ...parsed, origin: origin || "" });
      onClose();
    } catch(e) {
      setError("Couldn't generate suggestions. Try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,21,16,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--paper)", border:"1px solid var(--sand)", borderRadius:"16px", padding:"1.75rem", width:"100%", maxWidth:"420px", animation:"slideUp 0.25s ease both" }}>
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.4rem", fontWeight:900, marginBottom:"0.3rem" }}>Inspire me ✨</div>
        <p style={{ fontSize:"0.82rem", color:"var(--warm-mid)", marginBottom:"1.25rem", lineHeight:1.5 }}>Tell us your vibe and we'll fill in the rest.</p>

        <div style={{ fontSize:"0.63rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.6rem" }}>What kind of trip?</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.1rem" }}>
          {VIBES.map(v => (
            <button key={v.id} type="button" onClick={()=>setVibe(v.id)}
              style={{ padding:"0.65rem 0.75rem", borderRadius:"10px", border:"1.5px solid", borderColor:vibe===v.id?"var(--rust)":"var(--sand)", background:vibe===v.id?"#fff8f5":"var(--white)", cursor:"pointer", textAlign:"left", transition:"all 0.15s", fontFamily:"'DM Sans', sans-serif" }}>
              <div style={{ fontSize:"1.1rem", marginBottom:"0.15rem" }}>{v.icon}</div>
              <div style={{ fontSize:"0.82rem", fontWeight:600, color:vibe===v.id?"var(--rust)":"var(--ink)" }}>{v.label}</div>
              <div style={{ fontSize:"0.7rem", color:"var(--warm-mid)" }}>{v.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.6rem", marginBottom:"0.75rem" }}>
          <div>
            <div style={{ fontSize:"0.63rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.4rem" }}>Duration (optional)</div>
            <SelectInput value={duration} onChange={e=>setDuration(e.target.value)} style={{ fontSize:"0.85rem", padding:"0.6rem 0.85rem" }}>
              <option value="">Any length</option>
              <option>3-5 days</option>
              <option>1 week</option>
              <option>2 weeks</option>
              <option>3+ weeks</option>
            </SelectInput>
          </div>
          <div>
            <div style={{ fontSize:"0.63rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.4rem" }}>Budget (optional)</div>
            <SelectInput value={budget} onChange={e=>setBudget(e.target.value)} style={{ fontSize:"0.85rem", padding:"0.6rem 0.85rem" }}>
              <option value="">Any budget</option>
              {BUDGETS.map(b=><option key={b}>{b}</option>)}
            </SelectInput>
          </div>
        </div>

        <div style={{ marginBottom:"1rem" }}>
          <div style={{ fontSize:"0.63rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.4rem" }}>Travelling from (optional)</div>
          <FocusInput type="text" placeholder="e.g. London, New York..." value={origin} onChange={e=>setOrigin(e.target.value)} style={{ fontSize:"0.88rem" }} />
        </div>

        {error && <div style={{ fontSize:"0.8rem", color:"var(--rust-dk)", background:"#fff1ed", padding:"0.5rem 0.75rem", borderRadius:"6px", marginBottom:"0.75rem" }}>{error}</div>}

        <div style={{ display:"flex", gap:"0.6rem" }}>
          <button onClick={onClose} style={{ flex:1, padding:"0.72rem", background:"transparent", border:"1.5px solid var(--sand)", borderRadius:"8px", fontSize:"0.88rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>Cancel</button>
          <button onClick={inspire} disabled={loading}
            style={{ flex:2, padding:"0.72rem", background:loading?"var(--warm-mid)":"var(--rust)", border:"none", borderRadius:"8px", fontSize:"0.88rem", fontWeight:500, cursor:loading?"not-allowed":"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
            {loading ? <><Spinner />Thinking...</> : "Fill my trip ✨"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]                   = useState(null);
  const [authReady, setAuthReady]         = useState(false);
  const [showAuth, setShowAuth]           = useState(false);
  const [showHistory, setShowHistory]     = useState(false);
  const [showInspire, setShowInspire]     = useState(false);
  const [tripCount, setTripCount]         = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paidTrips, setPaidTrips]         = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Restore form from localStorage after Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      setPaymentStatus("success");
      setPaidTrips(n => n + 1);
      // Restore saved form state
      try {
        const saved = localStorage.getItem("wayflo_form");
        if (saved) {
          const f = JSON.parse(saved);
          setDestination(f.destination || "");
          setOrigin(f.origin || "");
          setDateFrom(f.dateFrom || "");
          setDateTo(f.dateTo || "");
          setBudget(f.budget || "");
          setTravelStyle(f.travelStyle || "");
          setInterests(f.interests || []);
          localStorage.removeItem("wayflo_form");
        }
      } catch(e) { /* ignore */ }
      window.history.replaceState({}, "", "/");
    } else if (payment === "cancelled") {
      setPaymentStatus("cancelled");
      try {
        const saved = localStorage.getItem("wayflo_form");
        if (saved) {
          const f = JSON.parse(saved);
          setDestination(f.destination || "");
          setOrigin(f.origin || "");
          setDateFrom(f.dateFrom || "");
          setDateTo(f.dateTo || "");
          setBudget(f.budget || "");
          setTravelStyle(f.travelStyle || "");
          setInterests(f.interests || []);
          localStorage.removeItem("wayflo_form");
        }
      } catch(e) { /* ignore */ }
      window.history.replaceState({}, "", "/");
    }
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setTripCount(0); setPaidTrips(0);
  }

  const [destination, setDestination]       = useState("");
  const [origin, setOrigin]                 = useState("");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [budget, setBudget]                 = useState("");
  const [travelStyle, setTravelStyle]       = useState("");
  const [interests, setInterests]           = useState([]);
  const [customInterest, setCustomInterest] = useState("");
  const [phase, setPhase]                   = useState("form");
  const [itinerary, setItinerary]           = useState(null);
  const [rawText, setRawText]               = useState("");
  const [photoQuery, setPhotoQuery]         = useState("");
  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining]             = useState(false);
  const [error, setError]                   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const requestInFlight                     = useRef(false);

  const hasFreeTripAvailable = tripCount === 0;
  const hasPaidTripAvailable = user && paidTrips > 0;
  const isBlocked            = !hasFreeTripAvailable && !hasPaidTripAvailable;

  async function startCheckout() {
    if (!user) { setShowAuth(true); return; }
    // Save form state before redirect
    try {
      localStorage.setItem("wayflo_form", JSON.stringify({ destination, origin, dateFrom, dateTo, budget, travelStyle, interests }));
    } catch(e) { /* ignore */ }
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ userId:user.id, email:user.email }),
      });
      if (!res.ok) throw new Error("Could not start checkout");
      const { url } = await res.json();
      window.location.href = url;
    } catch(e) { setError(e.message || "Payment failed. Try again."); }
  }

  function fillFromInspire(fields) {
    if (fields.destination) setDestination(fields.destination);
    if (fields.origin)      setOrigin(fields.origin);
    if (fields.dateFrom)    setDateFrom(fields.dateFrom);
    if (fields.dateTo)      setDateTo(fields.dateTo);
    if (fields.budget)      setBudget(fields.budget);
    if (fields.travelStyle) setTravelStyle(fields.travelStyle);
    if (fields.interests)   setInterests(fields.interests);
  }

  function toggleInterest(item) {
    setInterests(prev => prev.includes(item) ? prev.filter(i=>i!==item) : [...prev,item]);
  }
  function addCustomInterest() {
    const val = customInterest.trim();
    if (val && !interests.includes(val)) setInterests(prev=>[...prev,val]);
    setCustomInterest("");
  }

  function randomDatesSet() { const d = randomDates(); setDateFrom(d.from); setDateTo(d.to); }

  function parseItinerary(text) {
    try { return JSON.parse(text.replace(/```json|```/g,"").trim()); }
    catch { return { intro:"", photoQuery:"", days:[{ title:"Your Itinerary", content:text }] }; }
  }

  async function callEndpoint(body) {
    const res = await fetch("/api/generate", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||"Request failed ("+res.status+")"); }
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
      setTripCount(c=>c+1);
      if (paidTrips > 0) setPaidTrips(n=>n-1);
      setSaved(false); setPhase("result");
    } catch(e) { setError(e.message||"Something went wrong."); setPhase("form"); }
    finally { requestInFlight.current = false; }
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
    if (saving||saved) return;
    setSaving(true);
    const { error:saveError } = await supabase.from("trips").insert({
      user_id:user.id, destination, date_from:dateFrom||null, date_to:dateTo||null,
      budget, travel_style:travelStyle, origin, interests, itinerary,
    });
    if (saveError) setError("Couldn't save trip. Try again.");
    else setSaved(true);
    setSaving(false);
  }

  // Build display numbers for day cards
  function getDayDisplayNumber(title, index) {
    const lower = title.toLowerCase();
    if (lower.includes("getting there") || lower.includes("day 0")) return "00";
    if (lower.includes("getting home") || lower.includes("last day") || lower.includes("departure")) return "↩";
    return String(index).padStart(2,"0");
  }

  const busy = phase === "loading";

  if (!authReady) return null;

  return (
    <>
      <style>{FONT_INJECT}</style>
      {showAuth    && <Auth onClose={()=>setShowAuth(false)} />}
      {showInspire && <InspireModal onClose={()=>setShowInspire(false)} onFill={fillFromInspire} />}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom:"1px solid var(--sand)", background:"rgba(245,240,232,0.92)", backdropFilter:"blur(8px)", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:720, margin:"0 auto", padding:"0 1.25rem", height:"60px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          {/* Logo */}
          <div style={{ display:"flex", flexDirection:"column", cursor:"pointer", lineHeight:1 }}
            onClick={()=>{ setShowHistory(false); setPhase("form"); setItinerary(null); setError(""); }}>
            <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.45rem", fontWeight:900, color:"var(--rust)" }}>Wayflo</span>
            <span style={{ fontSize:"0.58rem", letterSpacing:"0.13em", textTransform:"uppercase", color:"var(--warm-mid)", marginTop:"1px" }}>Budget travel planner</span>
          </div>

          {/* Nav */}
          <nav style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            {phase === "result" && !showHistory && (
              <button onClick={()=>{ setPhase("form"); setItinerary(null); setError(""); }}
                style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>
                ← New trip
              </button>
            )}
            {user && (
              <button onClick={()=>setShowHistory(h=>!h)}
                style={{ background:showHistory?"var(--rust)":"none", color:showHistory?"#fff":"var(--warm-mid)", border:"1.5px solid", borderColor:showHistory?"var(--rust)":"var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap", transition:"all 0.15s" }}>
                {showHistory ? "← Back" : "My trips"}
              </button>
            )}
            {user ? (
              <>
                <div style={{ width:1, height:20, background:"var(--sand)" }} />
                <span style={{ fontSize:"0.73rem", color:"var(--warm-mid)", maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</span>
                <button onClick={signOut}
                  style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap" }}>
                  Sign out
                </button>
              </>
            ) : (
              <button onClick={()=>setShowAuth(true)}
                style={{ background:"var(--rust)", border:"none", borderRadius:"6px", padding:"0.42rem 1rem", fontSize:"0.78rem", cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth:680, margin:"0 auto", padding:"1.5rem 1.25rem" }}>

        {showHistory ? (
          <TripHistory onClose={()=>setShowHistory(false)} />
        ) : (
          <>
            {/* Status banners */}
            {!user && tripCount === 0 && phase === "form" && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"999px", padding:"0.3rem 0.85rem", fontSize:"0.75rem", color:"var(--green)", fontWeight:500, marginBottom:"1.1rem" }}>
                ✦ First itinerary is free — no account needed
              </div>
            )}
            {paymentStatus === "success" && phase === "form" && (
              <div style={{ background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"8px", padding:"0.65rem 1rem", fontSize:"0.82rem", color:"var(--green)", marginBottom:"1rem", fontWeight:500 }}>
                ✓ Payment successful — your trip is ready to generate!
              </div>
            )}
            {paymentStatus === "cancelled" && phase === "form" && (
              <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.65rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>
                Payment cancelled — no charge was made.
              </div>
            )}

            {/* ── FORM ───────────────────────────────────────────────────── */}
            {phase === "form" && (
              <div style={{ animation:"fadeUp 0.4s ease both" }}>
                {/* Hero */}
                <div style={{ marginBottom:"1.75rem" }}>
                  <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.9rem,7vw,2.8rem)", fontWeight:900, lineHeight:1.1, marginBottom:"0.5rem", color:"var(--ink)" }}>
                    Where are you<br /><span style={{ color:"var(--rust)" }}>running off to?</span>
                  </h1>
                  <p style={{ fontSize:"0.87rem", color:"var(--warm-mid)", lineHeight:1.6 }}>
                    Five questions. One perfect backpacker itinerary.
                  </p>
                </div>

                {/* Inspire Me + divider */}
                <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem" }}>
                  <div style={{ flex:1, height:1, background:"var(--sand)" }} />
                  <button onClick={()=>setShowInspire(true)}
                    style={{ padding:"0.5rem 1.1rem", background:"var(--white)", border:"1.5px solid var(--sand)", borderRadius:"999px", fontSize:"0.82rem", cursor:"pointer", color:"var(--ink-soft)", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", gap:"0.4rem", whiteSpace:"nowrap", transition:"border-color 0.15s, box-shadow 0.15s", fontWeight:500 }}
                    onMouseOver={e=>{ e.currentTarget.style.borderColor="var(--rust)"; e.currentTarget.style.boxShadow="0 2px 8px rgba(196,98,45,0.15)"; }}
                    onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--sand)"; e.currentTarget.style.boxShadow="none"; }}>
                    ✨ Inspire me
                  </button>
                  <div style={{ flex:1, height:1, background:"var(--sand)" }} />
                </div>

                {isBlocked && <PaywallBanner onSignIn={()=>setShowAuth(true)} onPay={startCheckout} user={user} />}

                {/* Field cards */}
                <FieldCard number={1} icon="📍" label="Destination" hint="City, country, or region"
                  action={<DiceBtn onClick={async()=>{
                    // Smart destination: use other fields as context if available
                    if (budget||travelStyle||interests.length) {
                      setShowInspire(true);
                    } else {
                      const picks = ["Bangkok, Thailand","Hanoi, Vietnam","Bali, Indonesia","Medellin, Colombia","Lisbon, Portugal","Budapest, Hungary","Marrakech, Morocco","Oaxaca, Mexico","Tbilisi, Georgia","Chiang Mai, Thailand","Split, Croatia","Sarajevo, Bosnia"];
                      setDestination(picks[Math.floor(Math.random()*picks.length)]);
                    }
                  }} title="Random destination" />}>
                  <FocusInput type="text" placeholder="e.g. Hanoi, Vietnam or Southeast Asia" value={destination} onChange={e=>setDestination(e.target.value)} />
                </FieldCard>

                <FieldCard number={2} icon="🛫" label="Travelling from" hint="Helps estimate your flight cost"
                  action={<DiceBtn onClick={()=>{ const o=["New York, USA","London, UK","Sydney, Australia","Toronto, Canada","Berlin, Germany","Sao Paulo, Brazil"]; setOrigin(o[Math.floor(Math.random()*o.length)]); }} title="Random origin" />}>
                  <FocusInput type="text" placeholder="Your departure city, e.g. New York" value={origin} onChange={e=>setOrigin(e.target.value)} />
                </FieldCard>

                <FieldCard number={3} icon="📅" label="Travel Dates" hint="When are you going?"
                  action={<DiceBtn onClick={randomDatesSet} title="Random dates" />}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.65rem" }}>
                    <div>
                      <div style={{ fontSize:"0.7rem", color:"var(--warm-mid)", marginBottom:"0.3rem" }}>From</div>
                      <FocusInput type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize:"0.7rem", color:"var(--warm-mid)", marginBottom:"0.3rem" }}>To</div>
                      <FocusInput type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
                    </div>
                  </div>
                </FieldCard>

                <FieldCard number={4} icon="💰" label="Total Trip Budget" hint="Everything — flights, accommodation, food, activities"
                  action={<DiceBtn onClick={()=>{ setBudget(BUDGETS[Math.floor(Math.random()*BUDGETS.length)]); }} title="Random budget" />}>
                  <SelectInput value={budget} onChange={e=>setBudget(e.target.value)}>
                    <option value="">Select a budget range</option>
                    {BUDGETS.map(b=><option key={b}>{b}</option>)}
                  </SelectInput>
                </FieldCard>

                <FieldCard number={5} icon="🧭" label="Travel Style" hint="How do you like to move through a place?"
                  action={<DiceBtn onClick={()=>setTravelStyle(STYLES[Math.floor(Math.random()*STYLES.length)])} title="Random style" />}>
                  <SelectInput value={travelStyle} onChange={e=>setTravelStyle(e.target.value)}>
                    <option value="">Choose your style</option>
                    {STYLES.map(s=><option key={s}>{s}</option>)}
                  </SelectInput>
                </FieldCard>

                <FieldCard number={6} icon="❤️" label="Interests" hint="What makes a trip worth it for you?">
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"0.45rem", marginBottom:"0.65rem" }}>
                    {INTERESTS_OPTIONS.map(item=><Chip key={item} label={item} selected={interests.includes(item)} onClick={()=>toggleInterest(item)} />)}
                    {interests.filter(i=>!INTERESTS_OPTIONS.includes(i)).map(i=><Chip key={i} label={i} selected={true} onClick={()=>toggleInterest(i)} />)}
                  </div>
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <FocusInput type="text" placeholder="Add your own..." value={customInterest}
                      onChange={e=>setCustomInterest(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&addCustomInterest()} style={{ flex:1 }} />
                    <button type="button" onClick={addCustomInterest} disabled={!customInterest.trim()}
                      style={{ padding:"0 1rem", background:customInterest.trim()?"var(--rust)":"var(--sand)", border:"none", borderRadius:"8px", color:customInterest.trim()?"#fff":"var(--warm-mid)", fontSize:"0.85rem", cursor:customInterest.trim()?"pointer":"not-allowed", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap", transition:"background 0.15s" }}>
                      + Add
                    </button>
                  </div>
                </FieldCard>

                {error && (
                  <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.65rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>
                    {error}
                  </div>
                )}

                <button onClick={generate} disabled={busy}
                  style={{ width:"100%", padding:"0.9rem 1.5rem", background:busy?"var(--warm-mid)":"var(--rust)", border:"none", borderRadius:"10px", fontSize:"1rem", fontWeight:600, cursor:busy?"not-allowed":"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", animation:busy?"none":"pulse-ring 2.5s infinite", transition:"background 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem" }}>
                  {busy ? <><Spinner size={16} />Generating...</> : "Generate my itinerary →"}
                </button>
              </div>
            )}

            {/* ── LOADING ─────────────────────────────────────────────────── */}
            {phase === "loading" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"65vh", gap:"1.2rem", animation:"fadeIn 0.3s ease both" }}>
                <div style={{ width:44, height:44, borderRadius:"50%", border:"3px solid var(--sand)", borderTopColor:"var(--rust)", animation:"spin 0.8s linear infinite" }} />
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.35rem", fontWeight:700, marginBottom:"0.3rem" }}>Plotting your adventure...</div>
                  <div style={{ fontSize:"0.82rem", color:"var(--warm-mid)" }}>Finding hidden gems, local spots, and the best routes.</div>
                </div>
              </div>
            )}

            {/* ── RESULT ──────────────────────────────────────────────────── */}
            {phase === "result" && itinerary && (
              <div style={{ animation:"fadeUp 0.4s ease both" }}>
                <HeroPhoto query={photoQuery} destination={destination} />
                <div style={{ marginBottom:"1.5rem" }}>
                  <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.35rem" }}>Your itinerary</div>
                  <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.4rem,5vw,2rem)", fontWeight:900, color:"var(--ink)", lineHeight:1.15, marginBottom:"0.65rem" }}>
                    {destination}
                  </h2>
                  {itinerary.intro && <p style={{ fontSize:"0.88rem", lineHeight:1.7, color:"var(--ink-soft)" }}>{itinerary.intro}</p>}
                  <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap", marginTop:"0.8rem" }}>
                    {[origin&&"From "+origin, dateFrom&&dateFrom+" to "+dateTo, budget, travelStyle].filter(Boolean).map(tag=>(
                      <span key={tag} style={{ padding:"0.22rem 0.65rem", background:"var(--sand)", borderRadius:"999px", fontSize:"0.72rem", color:"var(--ink)", fontWeight:500 }}>{tag}</span>
                    ))}
                  </div>
                </div>

                <div style={{ height:1, background:"var(--sand)", marginBottom:"1.25rem" }} />

                {/* Price disclaimer */}
                <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.75rem", color:"var(--warm-mid)", marginBottom:"1.1rem", display:"flex", gap:"0.5rem", alignItems:"flex-start" }}>
                  <span style={{ flexShrink:0 }}>⚠️</span>
                  <span>Prices, hours, and availability may have changed. Always verify before booking — treat this as a starting point, not a guarantee.</span>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem", marginBottom:"1.75rem" }}>
                  {itinerary.days.map((day,i) => (
                    <DayCard key={i} day={day} index={i} displayNumber={getDayDisplayNumber(day.title, i)} />
                  ))}
                </div>

                <button onClick={saveTrip} disabled={saving||saved}
                  style={{ width:"100%", padding:"0.82rem", background:saved?"var(--green)":saving?"var(--warm-mid)":"var(--ink)", border:"none", borderRadius:"8px", color:"var(--paper)", fontSize:"0.92rem", fontWeight:500, cursor:saved||saving?"default":"pointer", fontFamily:"'DM Sans', sans-serif", marginBottom:"0.85rem", transition:"background 0.3s", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                  {saved ? "✓ Trip saved" : saving ? <><Spinner />Saving...</> : "Save this trip"}
                </button>

                <div style={{ background:"var(--card-bg)", border:"1px solid var(--sand)", borderRadius:"10px", padding:"1.15rem" }}>
                  <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.45rem" }}>Refine</div>
                  <p style={{ fontSize:"0.8rem", color:"var(--warm-mid)", marginBottom:"0.8rem", lineHeight:1.5 }}>Not quite right? Tell us what to tweak.</p>
                  <FocusInput as="textarea" placeholder="e.g. More beach time, skip museums, I hate early mornings..."
                    value={refineFeedback} onChange={e=>setRefineFeedback(e.target.value)}
                    disabled={refining} rows={3}
                    style={{ resize:"vertical", marginBottom:"0.65rem", lineHeight:1.6, fontSize:"0.86rem", opacity:refining?0.6:1 }} />
                  {error && <div style={{ fontSize:"0.78rem", color:"var(--rust-dk)", marginBottom:"0.5rem" }}>{error}</div>}
                  <button onClick={refine} disabled={refining||!refineFeedback.trim()}
                    style={{ width:"100%", padding:"0.72rem", background:(refining||!refineFeedback.trim())?"var(--sand)":"var(--rust)", border:"none", borderRadius:"7px", color:(refining||!refineFeedback.trim())?"var(--warm-mid)":"#fff", fontSize:"0.88rem", fontWeight:500, cursor:(refining||!refineFeedback.trim())?"not-allowed":"pointer", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem", transition:"background 0.2s" }}>
                    {refining ? <><Spinner />Regenerating...</> : "↻ Regenerate itinerary"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ textAlign:"center", padding:"2rem 1rem 1.5rem", color:"var(--warm-mid)", fontSize:"0.68rem", letterSpacing:"0.06em", borderTop:"1px solid var(--sand)" }}>
        WAYFLO · First trip free · $5/trip after that
      </footer>
    </>
  );
}
