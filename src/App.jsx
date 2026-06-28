import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import TripHistory from "./TripHistory";
import TripMap from "./TripMap";
import LandingPage from "./LandingPage";
import ErrorBoundary from "./ErrorBoundary";
import { buildBookingLinks } from "./bookingLinks";
// mapbox-gl loaded via CDN in index.html — available as window.mapboxgl

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

// ── FREE MODE ────────────────────────────────────────────────────────────
// Set VITE_FREE_MODE=true in Vercel env vars to disable the paywall UI.
// generate.js has its own FREE_MODE env var that bypasses the server-side
// block — both need to be set together or the UI will promise free trips
// the backend then rejects.
const FREE_MODE = String(import.meta.env.VITE_FREE_MODE).toLowerCase() === "true";

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

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Smart defaults applied when destination is selected and Step 2 expands
const SMART_DEFAULTS = { budget:"$500-800", travelStyle:"Solo adventure", interests:["Street food & markets","Hiking & nature"] };

function DestinationMapInput({ value, onChange }) {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);
  const [search, setSearch]         = useState(value||"");
  const [results, setResults]       = useState([]);
  const [searching, setSearching]   = useState(false);
  const searchTimeout                = useRef(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !window.mapboxgl) return;
    const mbgl = window.mapboxgl;
    mbgl.accessToken = MAPBOX_TOKEN;
    const map = new mbgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [20, 20],
      zoom: 1.4,
      projection: "mercator",
      attributionControl: false,
    });
    map.addControl(new mbgl.AttributionControl({ compact: true }));
    map.on("click", async (e) => {
      const { lng, lat } = e.lngLat;
      placeMarker(map, lng, lat);
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,region,country&access_token=${MAPBOX_TOKEN}`);
        const d = await r.json();
        const name = d.features?.[0]?.place_name || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        setSearch(name);
        setResults([]);
        onChange(name, { lat, lng });
      } catch(e) {}
    });
    mapRef.current = map;
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  function placeMarker(map, lng, lat) {
    if (markerRef.current) markerRef.current.remove();
    const el = document.createElement("div");
    el.style.cssText = "width:14px;height:14px;background:var(--rust);border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(196,98,45,0.5)";
    markerRef.current = new window.mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    map.flyTo({ center: [lng, lat], zoom: 5, duration: 1000 });
  }

  async function handleSearchInput(val) {
    setSearch(val);
    onChange(val, null); // coords unknown until a result is selected
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!val.trim() || val.length < 2) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?types=place,region,country&limit=5&access_token=${MAPBOX_TOKEN}`);
        const d = await r.json();
        setResults(d.features || []);
      } catch(e) { setResults([]); }
      setSearching(false);
    }, 350);
  }

  async function selectResult(feature) {
    const name = feature.place_name;
    const [lng, lat] = feature.center;
    setSearch(name); setResults([]);
    onChange(name, { lat, lng });
    if (mapRef.current) placeMarker(mapRef.current, lng, lat);
  }

  return (
    <div style={{ position:"relative" }}>
      {/* Search bar */}
      <div style={{ position:"relative", marginBottom:"0.65rem" }}>
        <input
          type="text" placeholder="Search a destination or click the map..."
          value={search} onChange={e=>handleSearchInput(e.target.value)}
          style={{ ...inputBase, paddingLeft:"2.4rem" }} />
        <span style={{ position:"absolute", left:"0.85rem", top:"50%", transform:"translateY(-50%)", fontSize:"1rem", pointerEvents:"none" }}>🔍</span>
        {searching && <span style={{ position:"absolute", right:"0.85rem", top:"50%", transform:"translateY(-50%)" }}><Spinner size={12} color="var(--warm-mid)" /></span>}
      </div>
      {/* Autocomplete dropdown */}
      {results.length > 0 && (
        <div style={{ position:"absolute", top:"calc(100% - 0.65rem)", left:0, right:0, background:"var(--white)", border:"1.5px solid var(--sand)", borderRadius:"8px", zIndex:50, overflow:"hidden", boxShadow:"0 4px 16px rgba(26,21,16,0.1)" }}>
          {results.map(f=>(
            <button key={f.id} type="button" onClick={()=>selectResult(f)}
              style={{ display:"block", width:"100%", textAlign:"left", padding:"0.65rem 1rem", background:"none", border:"none", borderBottom:"1px solid var(--sand)", cursor:"pointer", fontSize:"0.84rem", color:"var(--ink)", fontFamily:"'DM Sans', sans-serif" }}
              onMouseOver={e=>e.currentTarget.style.background="var(--paper)"}
              onMouseOut={e=>e.currentTarget.style.background="none"}>
              📍 {f.place_name}
            </button>
          ))}
        </div>
      )}
      {/* Map */}
      <div ref={mapContainer} style={{ width:"100%", height:250, borderRadius:"10px", overflow:"hidden", border:"1.5px solid var(--sand)" }} />
    </div>
  );
}

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

const LOADING_MESSAGES = [
  "Plotting your adventure...",
  "Scouting hostels near the train station...",
  "Checking which buses run overnight...",
  "Sniffing out the tourist traps to skip...",
  "Pricing street food vs. sit-down meals...",
  "Mapping the slow route between stops...",
  "Asking around for the local's version...",
  "Double-checking those border crossings...",
  "Working out a realistic daily budget...",
  "Finding the view that's actually worth the climb...",
];

function randomDates() {
  const start = new Date(Date.now() + 864e5 * (Math.floor(Math.random() * 60) + 14));
  const end   = new Date(start.getTime() + 864e5 * (Math.floor(Math.random() * 18) + 5));
  return { from: start.toISOString().slice(0,10), to: end.toISOString().slice(0,10) };
}

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
      style={{ ...inputBase, ...(f?{borderColor:"var(--rust)",boxShadow:"0 0 0 3px rgba(196,98,45,0.1)"}:{}), ...style }}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}>
      {children}
    </Tag>
  );
}

function SelectInput({ style, children, ...props }) {
  const [f,setF] = useState(false);
  return (
    <select {...props}
      style={{ ...inputBase, appearance:"none", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239a8870' d='M6 8L0 0h12z'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"calc(100% - 14px) center", cursor:"pointer", ...(f?{borderColor:"var(--rust)",boxShadow:"0 0 0 3px rgba(196,98,45,0.1)"}:{}), ...style }}
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

function getDayDisplayNumber(title, index) {
  const lower = title.toLowerCase();
  if (lower.includes("getting there") || lower.includes("day 0")) return "00";
  if (lower.includes("getting home") || lower.includes("departure")) return "↩";
  return String(index).padStart(2,"0");
}

const NOTE_CATEGORIES = [
  { id:"closed",       label:"Closed",       icon:"🚫" },
  { id:"price_change", label:"Price change", icon:"💲" },
  { id:"safety",       label:"Safety",       icon:"⚠️" },
  { id:"tip",          label:"Tip",          icon:"💡" },
  { id:"other",        label:"Other",        icon:"📝" },
];

function categoryMeta(id) {
  return NOTE_CATEGORIES.find(c=>c.id===id) || NOTE_CATEGORIES[3];
}

function NoteCard({ note, user, onVote }) {
  const meta = categoryMeta(note.category);
  const [voting, setVoting] = useState(false);

  async function vote(v) {
    if (!user) return;
    setVoting(true);
    await onVote(note.id, v);
    setVoting(false);
  }

  return (
    <div style={{ background:"var(--paper)", border:"1px solid var(--sand)", borderRadius:"8px", padding:"0.7rem 0.85rem" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:"0.5rem", marginBottom:"0.4rem" }}>
        <span style={{ fontSize:"0.95rem", flexShrink:0 }}>{meta.icon}</span>
        <span style={{ fontSize:"0.82rem", color:"var(--ink-soft)", lineHeight:1.5 }}>{note.body}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"0.6rem" }}>
        <button type="button" disabled={voting} onClick={()=>vote("helpful")}
          style={{ display:"flex", alignItems:"center", gap:"0.25rem", background:"none", border:"none", cursor:voting?"default":"pointer", fontSize:"0.72rem", color:"var(--green)", padding:0, fontFamily:"'DM Sans', sans-serif" }}>
          👍 {note.helpful_count}
        </button>
        <button type="button" disabled={voting} onClick={()=>vote("outdated")}
          style={{ display:"flex", alignItems:"center", gap:"0.25rem", background:"none", border:"none", cursor:voting?"default":"pointer", fontSize:"0.72rem", color:"var(--rust-dk)", padding:0, fontFamily:"'DM Sans', sans-serif" }}>
          ⚠️ {note.outdated_count} outdated
        </button>
      </div>
    </div>
  );
}

function AddNoteForm({ onSubmit, onCancel }) {
  const [category, setCategory] = useState("tip");
  const [body, setBody]         = useState("");
  const [posting, setPosting]   = useState(false);

  async function submit() {
    if (!body.trim() || posting) return;
    setPosting(true);
    await onSubmit({ category, body: body.trim() });
    setPosting(false);
    setBody("");
  }

  return (
    <div style={{ background:"var(--white)", border:"1px dashed var(--sand)", borderRadius:"8px", padding:"0.75rem" }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"0.35rem", marginBottom:"0.6rem" }}>
        {NOTE_CATEGORIES.map(c=>(
          <Chip key={c.id} label={c.icon+" "+c.label} selected={category===c.id} onClick={()=>setCategory(c.id)} />
        ))}
      </div>
      <FocusInput as="textarea" rows={2} placeholder="e.g. Hostel closed for renovation as of June 2026..."
        value={body} onChange={e=>setBody(e.target.value)}
        style={{ resize:"none", fontSize:"0.84rem", marginBottom:"0.55rem" }} maxLength={500} />
      <div style={{ display:"flex", gap:"0.5rem" }}>
        <button type="button" onClick={onCancel}
          style={{ flex:1, padding:"0.5rem", background:"transparent", border:"1.5px solid var(--sand)", borderRadius:"7px", fontSize:"0.78rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={!body.trim()||posting}
          style={{ flex:2, padding:"0.5rem", background:(!body.trim()||posting)?"var(--sand)":"var(--rust)", border:"none", borderRadius:"7px", fontSize:"0.78rem", fontWeight:500, cursor:(!body.trim()||posting)?"not-allowed":"pointer", color:(!body.trim()||posting)?"var(--warm-mid)":"#fff", fontFamily:"'DM Sans', sans-serif" }}>
          {posting?"Posting...":"Post note"}
        </button>
      </div>
    </div>
  );
}

function NotesSection({ day, destination, user, onRequireAuth }) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [notes, setNotes]       = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState("");

  async function fetchNotes() {
    if (day.lat==null || day.lng==null) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ lat:day.lat, lng:day.lng, locationName: day.locationName||"" });
      const res = await fetch("/api/notes?"+params.toString());
      const data = await res.json();
      setNotes(data.notes||[]);
    } catch(e) { setError("Couldn't load notes."); }
    setLoading(false);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && notes===null) fetchNotes();
  }

  async function handleVote(noteId, vote) {
    try {
      await fetch("/api/notes", {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ userId:user.id, noteId, vote }),
      });
      fetchNotes();
    } catch(e) {}
  }

  async function handleSubmitNote({ category, body }) {
    try {
      const res = await fetch("/api/notes", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          userId:user.id, locationName: day.locationName||day.title,
          destination, lat:day.lat, lng:day.lng, category, body,
        }),
      });
      if (!res.ok) throw new Error();
      setShowForm(false);
      fetchNotes();
    } catch(e) { setError("Couldn't post note. Try again."); }
  }

  if (day.lat==null || day.lng==null) return null;

  return (
    <div style={{ borderTop:"1px solid var(--sand)", marginTop: "0.9rem", paddingTop:"0.75rem" }}>
      <button type="button" onClick={toggle}
        style={{ display:"flex", alignItems:"center", gap:"0.4rem", background:"none", border:"none", cursor:"pointer", fontSize:"0.78rem", color:"var(--ink-soft)", fontWeight:500, padding:0, fontFamily:"'DM Sans', sans-serif" }}>
        <span style={{ transform: open?"rotate(90deg)":"none", transition:"transform 0.15s", display:"inline-block", fontSize:"0.7rem" }}>▸</span>
        💬 Notes
      </button>

      {open && (
        <div style={{ marginTop:"0.7rem", display:"flex", flexDirection:"column", gap:"0.55rem", animation:"fadeIn 0.25s ease both" }}>
          {loading && <div style={{ fontSize:"0.78rem", color:"var(--warm-mid)", display:"flex", alignItems:"center", gap:"0.4rem" }}><Spinner size={12} color="var(--warm-mid)" />Loading notes...</div>}
          {!loading && notes && notes.length===0 && !showForm && (
            <div style={{ fontSize:"0.78rem", color:"var(--warm-mid)" }}>No notes yet — be the first to leave one.</div>
          )}
          {!loading && notes && notes.map(n=>(
            <NoteCard key={n.id} note={n} user={user} onVote={handleVote} />
          ))}
          {error && <div style={{ fontSize:"0.76rem", color:"var(--rust-dk)" }}>{error}</div>}

          {!showForm ? (
            <button type="button" onClick={()=>{ if(!user){ onRequireAuth(); return; } setShowForm(true); }}
              style={{ alignSelf:"flex-start", background:"none", border:"1.5px solid var(--sand)", borderRadius:"7px", padding:"0.4rem 0.8rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--rust)", fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>
              + Add a note
            </button>
          ) : (
            <AddNoteForm onSubmit={handleSubmitNote} onCancel={()=>setShowForm(false)} />
          )}
        </div>
      )}
    </div>
  );
}

function DayCard({ day, index, photo, dayRef, destination, user, onRequireAuth }) {
  const bullets      = day.content.split("\n").map(l=>l.replace(/^[*\-•] ?/,"").trim()).filter(Boolean);
  const cleanTitle   = day.title.replace(/^Day \d+\s*[-—]\s*/,"");
  const displayNum   = getDayDisplayNumber(day.title, index);
  const bookingLinks = day.bookingLinks || [];

  return (
    <div ref={dayRef} style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"10px", overflow:"hidden", animation:"fadeUp 0.35s ease both", animationDelay:index*0.05+"s" }}>
      {photo && (
        <div style={{ width:"100%", aspectRatio:"16/7", overflow:"hidden", position:"relative" }}>
          <img src={photo.url} alt={cleanTitle} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center center" }} />
          {photo.credit && (
            <a href={photo.credit.link+"?utm_source=wayflo&utm_medium=referral"} target="_blank" rel="noopener noreferrer"
              style={{ position:"absolute", bottom:"4px", right:"8px", fontSize:"0.58rem", color:"rgba(255,255,255,0.8)", textDecoration:"none" }}>
              {photo.credit.name} / Unsplash
            </a>
          )}
        </div>
      )}
      <div style={{ padding:"1rem 1.2rem" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"0.6rem", marginBottom:"0.65rem" }}>
          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.2rem", fontWeight:900, color:"var(--rust)", flexShrink:0 }}>{displayNum}</span>
          <span style={{ fontWeight:600, fontSize:"0.9rem", color:"var(--ink)" }}>{cleanTitle}</span>
        </div>
        <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:"0.4rem", marginBottom: bookingLinks.length > 0 ? "0.9rem" : 0 }}>
          {bullets.map((b,i)=>(
            <li key={i} style={{ display:"flex", gap:"0.5rem", fontSize:"0.84rem", lineHeight:1.5, color:"var(--ink-soft)" }}>
              <span style={{ color:"var(--rust)", flexShrink:0 }}>→</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        {bookingLinks.length > 0 && (
          <div style={{ borderTop:"1px solid var(--sand)", paddingTop:"0.75rem", display:"flex", flexWrap:"wrap", gap:"0.5rem" }}>
            {bookingLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-flex", alignItems:"center", gap:"0.3rem", padding:"0.3rem 0.75rem", background:"var(--paper)", border:"1px solid var(--sand)", borderRadius:"999px", fontSize:"0.74rem", color:"var(--rust)", textDecoration:"none", fontWeight:500, transition:"border-color 0.15s, background 0.15s" }}
                onMouseOver={e=>{ e.currentTarget.style.borderColor="var(--rust)"; e.currentTarget.style.background="#fff8f5"; }}
                onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--sand)"; e.currentTarget.style.background="var(--paper)"; }}>
                🔗 {link.label}
              </a>
            ))}
          </div>
        )}
        <NotesSection day={day} destination={destination} user={user} onRequireAuth={onRequireAuth} />
      </div>
    </div>
  );
}

function HeroPhoto({ query, destination }) {
  const [url, setUrl]         = useState("");
  const [credit, setCredit]   = useState(null);
  const [loaded, setLoaded]   = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!UNSPLASH_KEY) return;
    fetch("https://api.unsplash.com/photos/random?query="+encodeURIComponent(query||destination)+"&orientation=landscape&client_id="+UNSPLASH_KEY)
      .then(r=>r.json())
      .then(data=>{ if(data?.urls?.regular){ setUrl(data.urls.regular); setCredit({ name:data.user?.name, link:data.user?.links?.html }); } })
      .catch(()=>setErrored(true));
  }, [query, destination]);

  if (!UNSPLASH_KEY || errored || !url) return null;
  return (
    <div style={{ width:"100%", height:"240px", borderRadius:"12px", overflow:"hidden", background:"var(--sand)", marginBottom:"1.5rem", position:"relative" }}>
      {!loaded && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}><Spinner size={22} color="var(--warm-mid)" /></div>}
      <img src={url} alt={destination} onLoad={()=>setLoaded(true)} onError={()=>setErrored(true)}
        style={{ width:"100%", height:"100%", objectFit:"cover", opacity:loaded?1:0, transition:"opacity 0.4s" }} />
      {loaded && credit && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top, rgba(26,21,16,0.65), transparent)", padding:"1.5rem 1.2rem 0.7rem", display:"flex", justifyContent:"flex-end" }}>
          <a href={credit.link+"?utm_source=wayflo&utm_medium=referral"} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.75)", letterSpacing:"0.06em", textDecoration:"none" }}>
            Photo by {credit.name} on Unsplash
          </a>
        </div>
      )}
    </div>
  );
}

function PaywallBanner({ onSignIn, onPay, user }) {
  return (
    <div style={{ background:"var(--white)", border:"2px solid var(--rust)", borderRadius:"12px", padding:"1.5rem", textAlign:"center", marginBottom:"1.5rem", animation:"fadeUp 0.3s ease both" }}>
      <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.2rem", fontWeight:900, marginBottom:"0.4rem" }}>Your free trip is used up</div>
      <p style={{ fontSize:"0.85rem", color:"var(--warm-mid)", lineHeight:1.6, marginBottom:"1rem" }}>Your 3 free trips are used up. Each new itinerary is $2 — one flat fee, no subscription.</p>
      {!user ? (
        <button onClick={onSignIn} style={{ padding:"0.72rem 1.5rem", background:"var(--rust)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"0.9rem", fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Sign in to continue</button>
      ) : (
        <button onClick={onPay} style={{ padding:"0.72rem 1.5rem", background:"var(--rust)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"0.9rem", fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Pay $2 and generate</button>
      )}
    </div>
  );
}

function InspireModal({ onClose, onFill }) {
  const [vibe, setVibe]         = useState("");
  const [duration, setDuration] = useState("");
  const [budget, setBudget]     = useState("");
  const [origin, setOrigin]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function inspire() {
    if (!vibe) { setError("Pick a vibe first."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/inspire", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ vibe, duration, budget, origin }),
      });
      if (!res.ok) throw new Error("Server error");
      const data   = await res.json();
      const parsed = JSON.parse(data.raw.replace(/```json|```/g,"").trim());
      onFill({ ...parsed, origin: origin || "" });
      onClose();
    } catch(e) { setError("Couldn't generate suggestions. Try again."); }
    setLoading(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,21,16,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--paper)", border:"1px solid var(--sand)", borderRadius:"16px", padding:"1.75rem", width:"100%", maxWidth:"420px", animation:"slideUp 0.25s ease both", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.4rem", fontWeight:900, marginBottom:"0.3rem" }}>Inspire me ✨</div>
        <p style={{ fontSize:"0.82rem", color:"var(--warm-mid)", marginBottom:"1.25rem", lineHeight:1.5 }}>Tell us your vibe and we'll fill in the rest.</p>
        <div style={{ fontSize:"0.63rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.6rem" }}>What kind of trip?</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.1rem" }}>
          {VIBES.map(v=>(
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
              <option>3-5 days</option><option>1 week</option><option>2 weeks</option><option>3+ weeks</option>
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

export default function App() {
  const [user, setUser]                   = useState(null);
  const [authReady, setAuthReady]         = useState(false);
  const [showAuth, setShowAuth]           = useState(false);
  const [showHistory, setShowHistory]     = useState(false);
  const [showInspire, setShowInspire]     = useState(false);
  const [showLanding, setShowLanding]     = useState(true);
  const [tripCount, setTripCount]         = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paidTrips, setPaidTrips]         = useState(0);

  const [destination, setDestination]       = useState("");
  const [destCoords, setDestCoords]         = useState(null);
  const [step2Open, setStep2Open]           = useState(false);
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
  const [dayPhotos, setDayPhotos]           = useState({});
  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining]             = useState(false);
  const [error, setError]                   = useState("");
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const requestInFlight                     = useRef(false);
  const dayRefs                             = useRef({});

  function handleDestinationSelect(name, coords) {
    setDestination(name);
    if (coords) setDestCoords(coords);
    if (name.trim()) {
      // Apply smart defaults only if user hasn't already set these
      if (!budget) setBudget(SMART_DEFAULTS.budget);
      if (!travelStyle) setTravelStyle(SMART_DEFAULTS.travelStyle);
      if (!interests.length) setInterests(SMART_DEFAULTS.interests);
      setStep2Open(true);
    } else {
      setStep2Open(false);
    }
  }

  async function fetchTripStatus(userId) {
    try {
      const res = await fetch("/api/trips-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      // Initialize tripCount from DB so paywall is correct across sessions
      setTripCount(data.trips_generated || 0);
      setPaidTrips(data.paid_trips || 0);
    } catch(e) { console.warn("Could not fetch trip status:", e); }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (session?.user) fetchTripStatus(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTripStatus(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" || payment === "cancelled") {
      if (payment === "success") {
        setPaymentStatus("success");
        // Set paidTrips=1 immediately so UI unlocks right away
        setPaidTrips(1);
        // Confirm payment server-side and credit DB
        const sessionId = params.get("session_id");
        if (sessionId) {
          supabase.auth.getSession().then(async ({ data: { session: authSession } }) => {
            if (!authSession?.user) return;
            try {
              const res = await fetch("/api/confirm-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, userId: authSession.user.id }),
              });
              const data = await res.json();
              if (data.paid_trips) setPaidTrips(data.paid_trips);
            } catch(e) { console.warn("Payment confirm failed:", e); }
          });
        }
      }
      else setPaymentStatus("cancelled");
      try {
        const saved = localStorage.getItem("wayflo_form");
        if (saved) {
          const f = JSON.parse(saved);
          setDestination(f.destination||""); setOrigin(f.origin||"");
          setDateFrom(f.dateFrom||""); setDateTo(f.dateTo||"");
          setBudget(f.budget||""); setTravelStyle(f.travelStyle||"");
          setInterests(f.interests||[]);
          localStorage.removeItem("wayflo_form");
        }
      } catch(e) {}
      setShowLanding(false);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (!itinerary || !UNSPLASH_KEY) return;
    setDayPhotos({});
    itinerary.days.forEach((day, i) => {
      // Use per-day photoQuery from AI if available, fall back to locationName + destination
      const q = day.photoQuery || day.locationName || day.title.replace(/^Day \d+\s*[-—]\s*/,"") + " " + destination;
      fetch("https://api.unsplash.com/photos/random?query="+encodeURIComponent(q)+"&orientation=landscape&client_id="+UNSPLASH_KEY)
        .then(r=>r.json())
        .then(data=>{ if(data?.urls?.regular){ setDayPhotos(prev=>({ ...prev, [i]:{ url:data.urls.regular, credit:{ name:data.user?.name, link:data.user?.links?.html } } })); } })
        .catch(()=>{});
    });
  }, [itinerary]);

  // Rotate loading messages while a generation request is in flight.
  useEffect(() => {
    if (phase !== "loading") { setLoadingMsgIndex(0); return; }
    const interval = setInterval(() => {
      setLoadingMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [phase]);

  async function signOut() { await supabase.auth.signOut(); setTripCount(0); setPaidTrips(0); }

  const isBlocked = !FREE_MODE && tripCount >= 3 && !(user && paidTrips > 0);

  async function startCheckout() {
    if (!user) { setShowAuth(true); return; }
    try { localStorage.setItem("wayflo_form", JSON.stringify({ destination, origin, dateFrom, dateTo, budget, travelStyle, interests })); } catch(e) {}
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ userId:user.id, email:user.email }),
      });
      if (!res.ok) throw new Error("Could not start checkout");
      const { url } = await res.json();
      window.location.href = url;
    } catch(e) { setError(e.message||"Payment failed. Try again."); }
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

  function toggleInterest(item) { setInterests(prev=>prev.includes(item)?prev.filter(i=>i!==item):[...prev,item]); }
  function addCustomInterest() {
    const val = customInterest.trim();
    if (val && !interests.includes(val)) setInterests(prev=>[...prev,val]);
    setCustomInterest("");
  }
  function randomDatesSet() { const d=randomDates(); setDateFrom(d.from); setDateTo(d.to); }

  function parseItinerary(text, tripContext) {
    try {
      // Strip markdown fences, handle both styles
      let clean = text.trim();
      // Remove ```json ... ``` wrapper
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      // Remove any remaining backtick fences
      clean = clean.replace(/```/g, "").trim();
      // Find the first { to handle any preamble text
      const firstBrace = clean.indexOf("{");
      if (firstBrace > 0) clean = clean.slice(firstBrace);
      // Find the last } to handle any trailing text
      const lastBrace = clean.lastIndexOf("}");
      if (lastBrace !== -1 && lastBrace < clean.length - 1) clean = clean.slice(0, lastBrace + 1);
      const parsed = JSON.parse(clean);
      // Enrich with deterministic booking links
      if (parsed.days && tripContext) {
        parsed.days = parsed.days.map(day => ({
          ...day,
          bookingLinks: buildBookingLinks(day, tripContext),
        }));
      }
      return parsed;
    }
    catch { return { intro:"", photoQuery:"", days:[{ title:"Your Itinerary", content:text, bookingLinks:[] }] }; }
  }

  async function callEndpoint(body) {
    const res = await fetch("/api/generate", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
    });
    if (!res.ok) {
      const e = await res.json().catch(()=>({}));
      if (res.status === 402) throw new Error("payment_required");
      throw new Error(e.error||"Request failed");
    }
    return (await res.json()).raw;
  }

  async function generate() {
    if (!destination||!dateFrom||!dateTo||!budget||!travelStyle) { setError("Please fill in all fields."); return; }
    if (isBlocked) { if (!user) setShowAuth(true); else startCheckout(); return; }
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(""); setPhase("loading");
    try {
      const text   = await callEndpoint({ destination, origin, dateFrom, dateTo, budget, travelStyle, interests, userId: user?.id || null, paidTrips });
      const parsed = parseItinerary(text, { origin, destination, dateFrom, dateTo });
      setRawText(text); setItinerary(parsed);
      setPhotoQuery(parsed.photoQuery||destination);
      setTripCount(c=>c+1);
      if (paidTrips>0) setPaidTrips(n=>n-1);
      setSaved(false); setPhase("result");
    } catch(e) {
      if (e.message === "payment_required") { startCheckout(); setPhase("form"); }
      else { setError(e.message||"Something went wrong."); setPhase("form"); }
    } finally { requestInFlight.current=false; }
  }

  async function refine() {
    if (!refineFeedback.trim()||requestInFlight.current) return;
    if (isBlocked) { if (!user) setShowAuth(true); else startCheckout(); return; }
    requestInFlight.current = true;
    setRefining(true); setError("");
    try {
      const text   = await callEndpoint({ destination, origin, dateFrom, dateTo, budget, travelStyle, interests, refineFeedback, previousItinerary:rawText, userId:user?.id||null, paidTrips });
      const parsed = parseItinerary(text, { origin, destination, dateFrom, dateTo });
      setRawText(text); setItinerary(parsed);
      setPhotoQuery(parsed.photoQuery||destination);
      setRefineFeedback("");
    } catch(e) { setError(e.message||"Refinement failed."); }
    finally { setRefining(false); requestInFlight.current=false; }
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

  const busy = phase === "loading";

  if (!authReady) return null;

  // ── HEADER (shown on all non-landing views) ───────────────────────────────
  const header = !showLanding && (
    <header style={{ borderBottom:"1px solid var(--sand)", background:"rgba(245,240,232,0.92)", backdropFilter:"blur(8px)", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ maxWidth:700, margin:"0 auto", padding:"0 1.5rem", height:"64px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", flexDirection:"column", cursor:"pointer", lineHeight:1 }}
          onClick={()=>{ setShowHistory(false); setShowLanding(true); }}>
          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.45rem", fontWeight:900, color:"var(--rust)" }}>Wayflo</span>
          <span style={{ fontSize:"0.58rem", letterSpacing:"0.13em", textTransform:"uppercase", color:"var(--warm-mid)", marginTop:"1px" }}>Budget travel planner</span>
        </div>
        <nav style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
          {phase==="result" && !showHistory && (
            <button onClick={()=>{ setPhase("form"); setItinerary(null); setError(""); setDestination(""); setDestCoords(null); setStep2Open(false); setOrigin(""); setDateFrom(""); setDateTo(""); setBudget(""); setTravelStyle(""); setInterests([]); setSaved(false); }}
              style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>
              ← New trip
            </button>
          )}
          {user && (
            <button onClick={()=>setShowHistory(h=>!h)}
              style={{ background:showHistory?"var(--rust)":"none", color:showHistory?"#fff":"var(--warm-mid)", border:"1.5px solid", borderColor:showHistory?"var(--rust)":"var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap", transition:"all 0.15s" }}>
              {showHistory?"← Back":"My trips"}
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
  );

  // ── LANDING HEADER ────────────────────────────────────────────────────────
  const landingHeader = showLanding && (
    <header style={{ position:"absolute", top:0, left:0, right:0, zIndex:10, padding:"1.25rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", maxWidth:"100%" }}>
      <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
        <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.45rem", fontWeight:900, color:"var(--rust)" }}>Wayflo</span>
        <span style={{ fontSize:"0.58rem", letterSpacing:"0.13em", textTransform:"uppercase", color:"var(--warm-mid)", marginTop:"1px" }}>Budget travel planner</span>
      </div>
      <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
        {user ? (
          <>
            <button onClick={()=>{ setShowLanding(false); setShowHistory(true); }}
              style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>
              My trips
            </button>
            <button onClick={signOut}
              style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.4rem 0.9rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif" }}>
              Sign out
            </button>
          </>
        ) : (
          <button onClick={()=>setShowAuth(true)}
            style={{ background:"var(--rust)", border:"none", borderRadius:"6px", padding:"0.42rem 1rem", fontSize:"0.78rem", cursor:"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );

  const footerLabel = FREE_MODE
    ? "WAYFLO · Free during early access"
    : "WAYFLO · First trip free · $2/trip after that";

  return (
    <>
      <style>{FONT_INJECT}</style>
      {showAuth    && <Auth onClose={()=>setShowAuth(false)} />}
      {showInspire && <InspireModal onClose={()=>setShowInspire(false)} onFill={fillFromInspire} />}

      {/* Landing page */}
      {showLanding && (
        <div style={{ position:"relative" }}>
          {landingHeader}
          <LandingPage onGetStarted={()=>setShowLanding(false)} user={user} />
          <footer style={{ textAlign:"center", padding:"1.5rem 1rem", color:"var(--warm-mid)", fontSize:"0.68rem", letterSpacing:"0.06em", borderTop:"1px solid var(--sand)" }}>
            {footerLabel}
          </footer>
        </div>
      )}

      {/* App */}
      {!showLanding && (
        <>
          {header}
          <main style={{ maxWidth:700, margin:"0 auto", padding:"1.5rem 1.5rem" }}>
            <div style={{ display: showHistory ? "block" : "none" }}>
              <TripHistory onClose={()=>setShowHistory(false)} />
            </div>
            <div style={{ display: showHistory ? "none" : "block" }}>

              {FREE_MODE && phase==="form" && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"999px", padding:"0.3rem 0.85rem", fontSize:"0.75rem", color:"var(--green)", fontWeight:500, marginBottom:"1.1rem" }}>
                  ✦ Free during early access — generate as many trips as you like
                </div>
              )}
              {!FREE_MODE && !user && tripCount===0 && phase==="form" && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"999px", padding:"0.3rem 0.85rem", fontSize:"0.75rem", color:"var(--green)", fontWeight:500, marginBottom:"1.1rem" }}>
                  ✦ First 3 itineraries are free — no account needed
                </div>
              )}
              {paymentStatus==="success" && phase==="form" && (
                <div style={{ background:"#edf7f1", border:"1px solid #b2d9c3", borderRadius:"8px", padding:"0.65rem 1rem", fontSize:"0.82rem", color:"var(--green)", marginBottom:"1rem", fontWeight:500 }}>
                  ✓ Payment successful — your trip is ready to generate!
                </div>
              )}
              {paymentStatus==="cancelled" && phase==="form" && (
                <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.65rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>
                  Payment cancelled — no charge was made.
                </div>
              )}

              {/* FORM */}
              {phase==="form" && (
                <div style={{ animation:"fadeUp 0.4s ease both" }}>
                  <div style={{ marginBottom:"1.5rem" }}>
                    <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.9rem,7vw,2.8rem)", fontWeight:900, lineHeight:1.1, marginBottom:"0.4rem", color:"var(--ink)" }}>
                      Where are you<br /><span style={{ color:"var(--rust)" }}>running off to?</span>
                    </h1>
                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginTop:"0.85rem" }}>
                      <p style={{ fontSize:"0.87rem", color:"var(--warm-mid)", lineHeight:1.6, margin:0 }}>Pick a destination to get started.</p>
                      <button onClick={()=>setShowInspire(true)}
                        style={{ flexShrink:0, padding:"0.35rem 0.85rem", background:"var(--white)", border:"1.5px solid var(--sand)", borderRadius:"999px", fontSize:"0.78rem", cursor:"pointer", color:"var(--ink-soft)", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", gap:"0.35rem", transition:"border-color 0.15s", fontWeight:500, whiteSpace:"nowrap" }}
                        onMouseOver={e=>e.currentTarget.style.borderColor="var(--rust)"}
                        onMouseOut={e=>e.currentTarget.style.borderColor="var(--sand)"}>
                        ✨ Inspire me
                      </button>
                    </div>
                  </div>

                  {isBlocked && <PaywallBanner onSignIn={()=>setShowAuth(true)} onPay={startCheckout} user={user} />}

                  {/* ── STEP 1: Destination map + dates ── */}
                  <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"14px", padding:"1.25rem", marginBottom:"0.85rem" }}>
                    <div style={{ fontSize:"0.62rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.85rem" }}>
                      Where to?
                    </div>
                    <DestinationMapInput
                      value={destination}
                      onChange={(name, coords) => handleDestinationSelect(name, coords || null)}
                    />

                    {/* Dates — shown once destination is set */}
                    {destination && (
                      <div style={{ marginTop:"1rem", animation:"fadeIn 0.25s ease both" }}>
                        <div style={{ fontSize:"0.62rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.65rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          When?
                          <DiceBtn onClick={randomDatesSet} title="Random dates" />
                        </div>
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
                      </div>
                    )}
                  </div>

                  {/* ── STEP 2: Budget, style, interests (auto-expands) ── */}
                  {step2Open && (
                    <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"14px", padding:"1.25rem", marginBottom:"0.85rem", animation:"fadeUp 0.3s ease both" }}>
                      <div style={{ fontSize:"0.62rem", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"1rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        Customise your trip
                        <span style={{ fontSize:"0.68rem", fontWeight:400, textTransform:"none", letterSpacing:0, color:"var(--warm-mid)", opacity:0.7 }}>smart defaults applied — tweak anything</span>
                      </div>

                      {/* Origin */}
                      <div style={{ marginBottom:"0.85rem" }}>
                        <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginBottom:"0.35rem" }}>Travelling from <span style={{ opacity:0.6 }}>(optional)</span></div>
                        <FocusInput type="text" placeholder="Your departure city, e.g. London" value={origin} onChange={e=>setOrigin(e.target.value)} />
                      </div>

                      {/* Budget */}
                      <div style={{ marginBottom:"0.85rem" }}>
                        <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginBottom:"0.35rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          Total budget
                          <DiceBtn onClick={()=>setBudget(BUDGETS[Math.floor(Math.random()*BUDGETS.length)])} title="Random budget" />
                        </div>
                        <SelectInput value={budget} onChange={e=>setBudget(e.target.value)}>
                          <option value="">Select a budget range</option>
                          {BUDGETS.map(b=><option key={b}>{b}</option>)}
                        </SelectInput>
                      </div>

                      {/* Travel style */}
                      <div style={{ marginBottom:"0.85rem" }}>
                        <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginBottom:"0.35rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          Travel style
                          <DiceBtn onClick={()=>setTravelStyle(STYLES[Math.floor(Math.random()*STYLES.length)])} title="Random style" />
                        </div>
                        <SelectInput
                          value={STYLES.includes(travelStyle)||travelStyle===""?travelStyle:"__custom__"}
                          onChange={e=>{ if(e.target.value==="__custom__") setTravelStyle("__custom__"); else setTravelStyle(e.target.value); }}>
                          <option value="">Choose your style</option>
                          {STYLES.map(s=><option key={s}>{s}</option>)}
                          <option value="__custom__">Describe my own style...</option>
                        </SelectInput>
                        {travelStyle==="__custom__" && (
                          <FocusInput as="textarea" rows={2}
                            placeholder="e.g. I like getting lost in local neighbourhoods..."
                            value="" onChange={e=>setTravelStyle(e.target.value)}
                            style={{ marginTop:"0.5rem", resize:"none", fontSize:"0.88rem", lineHeight:1.5 }} />
                        )}
                      </div>

                      {/* Interests */}
                      <div>
                        <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>Interests</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.4rem", marginBottom:"0.6rem" }}>
                          {INTERESTS_OPTIONS.map(item=><Chip key={item} label={item} selected={interests.includes(item)} onClick={()=>toggleInterest(item)} />)}
                          {interests.filter(i=>!INTERESTS_OPTIONS.includes(i)).map(i=><Chip key={i} label={i} selected={true} onClick={()=>toggleInterest(i)} />)}
                        </div>
                        <div style={{ display:"flex", gap:"0.5rem" }}>
                          <FocusInput type="text" placeholder="Add your own..." value={customInterest}
                            onChange={e=>setCustomInterest(e.target.value)}
                            onKeyDown={e=>e.key==="Enter"&&addCustomInterest()} style={{ flex:1 }} />
                          <button type="button" onClick={addCustomInterest} disabled={!customInterest.trim()}
                            style={{ padding:"0 1rem", background:customInterest.trim()?"var(--rust)":"var(--sand)", border:"none", borderRadius:"8px", color:customInterest.trim()?"#fff":"var(--warm-mid)", fontSize:"0.85rem", cursor:customInterest.trim()?"pointer":"not-allowed", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap" }}>
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.65rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>{error}</div>}

                  <button onClick={generate} disabled={busy||!destination||!dateFrom||!dateTo}
                    style={{ width:"100%", padding:"0.9rem 1.5rem", background:(busy||!destination||!dateFrom||!dateTo)?"var(--warm-mid)":"var(--rust)", border:"none", borderRadius:"10px", fontSize:"1rem", fontWeight:600, cursor:(busy||!destination||!dateFrom||!dateTo)?"not-allowed":"pointer", color:"#fff", fontFamily:"'DM Sans', sans-serif", animation:(busy||!destination||!dateFrom||!dateTo)?"none":"pulse-ring 2.5s infinite", transition:"background 0.2s", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.6rem" }}>
                    {busy ? <><Spinner size={16} />Generating...</> : !destination ? "Pick a destination first" : (!dateFrom||!dateTo) ? "Add travel dates" : "Generate my itinerary →"}
                  </button>
                </div>
              )}

              {/* LOADING */}
              {phase==="loading" && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"65vh", gap:"1.2rem", animation:"fadeIn 0.3s ease both" }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", border:"3px solid var(--sand)", borderTopColor:"var(--rust)", animation:"spin 0.8s linear infinite" }} />
                  <div style={{ textAlign:"center", minHeight:"3.2rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div
                      key={loadingMsgIndex}
                      style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.2rem", fontWeight:700, color:"var(--ink)", animation:"fadeIn 0.4s ease both" }}>
                      {LOADING_MESSAGES[loadingMsgIndex]}
                    </div>
                  </div>
                </div>
              )}

              {/* RESULT */}
              {phase==="result" && itinerary && (
                <div style={{ animation:"fadeUp 0.4s ease both" }}>
                  <HeroPhoto query={photoQuery} destination={destination} />
                  <div style={{ marginBottom:"1.25rem" }}>
                    <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.35rem" }}>Your itinerary</div>
                    <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.4rem,5vw,2rem)", fontWeight:900, color:"var(--ink)", lineHeight:1.15, marginBottom:"0.65rem" }}>{destination}</h2>
                    {itinerary.intro && <p style={{ fontSize:"0.88rem", lineHeight:1.7, color:"var(--ink-soft)" }}>{itinerary.intro}</p>}
                    <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap", marginTop:"0.8rem" }}>
                      {[origin&&"From "+origin, dateFrom&&dateFrom+" to "+dateTo, budget, travelStyle].filter(Boolean).map(tag=>(
                        <span key={tag} style={{ padding:"0.22rem 0.65rem", background:"var(--sand)", borderRadius:"999px", fontSize:"0.72rem", color:"var(--ink)", fontWeight:500 }}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ height:1, background:"var(--sand)", marginBottom:"1.25rem" }} />

                  <div style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.75rem", color:"var(--warm-mid)", marginBottom:"1.25rem", display:"flex", gap:"0.5rem", alignItems:"flex-start", lineHeight:1.5 }}>
                    <span style={{ flexShrink:0 }}>⚠️</span>
                    <span>Transport times and prices are estimates — book ahead for lower fares, expect higher costs last-minute. Always verify opening hours and availability before you go.</span>
                  </div>

                  <ErrorBoundary fallback={null}>
                    <TripMap days={itinerary.days} dayPhotos={dayPhotos} />
                  </ErrorBoundary>

                  <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem", marginBottom:"1.75rem" }}>
                    {itinerary.days.map((day,i)=>(
                      <DayCard key={i} day={day} index={i} photo={dayPhotos[i]} dayRef={el=>{ dayRefs.current[i]=el; }}
                        destination={destination} user={user} onRequireAuth={()=>setShowAuth(true)} />
                    ))}
                  </div>

                  <button onClick={saveTrip} disabled={saving||saved}
                    style={{ width:"100%", padding:"0.82rem", background:saved?"var(--green)":saving?"var(--warm-mid)":"var(--ink)", border:"none", borderRadius:"8px", color:"var(--paper)", fontSize:"0.92rem", fontWeight:500, cursor:saved||saving?"default":"pointer", fontFamily:"'DM Sans', sans-serif", marginBottom:"0.85rem", transition:"background 0.3s", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                    {saved?"✓ Trip saved":saving?<><Spinner />Saving...</>:"Save this trip"}
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
                      style={{ width:"100%", padding:"0.72rem", background:(refining||!refineFeedback.trim())?"var(--sand)":"var(--rust)", border:"none", borderRadius:"7px", color:(refining||!refineFeedback.trim())?"var(--warm-mid)":"#fff", fontSize:"0.88rem", fontWeight:500, cursor:(refining||!refineFeedback.trim())?"not-allowed":"pointer", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:"0.5rem" }}>
                      {refining?<><Spinner />Regenerating...</>:"↻ Regenerate itinerary"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
          <footer style={{ textAlign:"center", padding:"2rem 1rem 1.5rem", color:"var(--warm-mid)", fontSize:"0.68rem", letterSpacing:"0.06em", borderTop:"1px solid var(--sand)" }}>
            {footerLabel}
          </footer>
        </>
      )}
    </>
  );
}
