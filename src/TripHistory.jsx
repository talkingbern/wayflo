// src/TripHistory.jsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import TripMap from "./TripMap";

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

function Spinner({ size=18, color="var(--warm-mid)" }) {
  return <span style={{ width:size, height:size, borderRadius:"50%", border:`2px solid ${color}4`, borderTopColor:color, animation:"spin 0.7s linear infinite", display:"inline-block" }} />;
}

function TripCard({ trip, onOpen }) {
  const date = new Date(trip.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
  const days = trip.date_from && trip.date_to
    ? Math.round((new Date(trip.date_to) - new Date(trip.date_from)) / 864e5)
    : null;
  return (
    <div onClick={onOpen}
      style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"10px", padding:"1rem 1.2rem", cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s", animation:"fadeUp 0.35s ease both" }}
      onMouseOver={e=>{ e.currentTarget.style.borderColor="var(--rust)"; e.currentTarget.style.boxShadow="0 2px 12px rgba(196,98,45,0.1)"; }}
      onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--sand)"; e.currentTarget.style.boxShadow="none"; }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"0.5rem" }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.05rem", fontWeight:700, color:"var(--ink)", marginBottom:"0.25rem" }}>{trip.destination}</div>
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            {trip.date_from && <span style={{ fontSize:"0.72rem", color:"var(--warm-mid)" }}>{trip.date_from} → {trip.date_to}</span>}
            {days && <span style={{ fontSize:"0.72rem", color:"var(--warm-mid)" }}>· {days} days</span>}
            {trip.budget && <span style={{ fontSize:"0.72rem", color:"var(--warm-mid)" }}>· {trip.budget}</span>}
          </div>
        </div>
        <div style={{ fontSize:"0.7rem", color:"var(--warm-mid)", whiteSpace:"nowrap", flexShrink:0 }}>{date}</div>
      </div>
      {trip.travel_style && (
        <div style={{ marginTop:"0.5rem" }}>
          <span style={{ padding:"0.2rem 0.6rem", background:"var(--sand)", borderRadius:"999px", fontSize:"0.7rem", color:"var(--ink-soft)" }}>{trip.travel_style}</span>
        </div>
      )}
    </div>
  );
}

function DayCard({ day, index, displayNumber, photo, dayRef }) {
  const bullets = day.content.split("\n").map(l=>l.replace(/^[*\-•] ?/,"").trim()).filter(Boolean);
  const cleanTitle = day.title.replace(/^Day \d+\s*[-—]\s*/,"");
  return (
    <div ref={dayRef} style={{ background:"var(--white)", border:"1px solid var(--sand)", borderRadius:"10px", overflow:"hidden", animation:"fadeUp 0.35s ease both", animationDelay:index*0.05+"s" }}>
      {photo && (
        <div style={{ width:"100%", height:"140px", overflow:"hidden", position:"relative" }}>
          <img src={photo.url} alt={cleanTitle}
            style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          {photo.credit && (
            <a href={photo.credit.link+"?utm_source=wayflo&utm_medium=referral"} target="_blank" rel="noopener noreferrer"
              style={{ position:"absolute", bottom:"4px", right:"8px", fontSize:"0.58rem", color:"rgba(255,255,255,0.75)", textDecoration:"none" }}>
              {photo.credit.name} / Unsplash
            </a>
          )}
        </div>
      )}
      <div style={{ padding:"1rem 1.2rem" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:"0.6rem", marginBottom:"0.65rem" }}>
          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.2rem", fontWeight:900, color:"var(--rust)", flexShrink:0 }}>{displayNumber}</span>
          <span style={{ fontWeight:600, fontSize:"0.9rem", color:"var(--ink)" }}>{cleanTitle}</span>
        </div>
        <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
          {bullets.map((b,i)=>(
            <li key={i} style={{ display:"flex", gap:"0.5rem", fontSize:"0.84rem", lineHeight:1.5, color:"var(--ink-soft)" }}>
              <span style={{ color:"var(--rust)", flexShrink:0 }}>→</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function getDayDisplayNumber(title, index) {
  const lower = title.toLowerCase();
  if (lower.includes("getting there") || lower.includes("day 0")) return "00";
  if (lower.includes("getting home") || lower.includes("departure")) return "↩";
  return String(index).padStart(2,"0");
}

export default function TripHistory({ onClose }) {
  const [trips, setTrips]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError]       = useState("");
  const [deleting, setDeleting] = useState(null);
  const [dayPhotos, setDayPhotos] = useState({});
  const dayRefs = useRef({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from("trips").select("*").order("created_at", { ascending:false });
      if (error) setError("Couldn't load trips.");
      else setTrips(data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Fetch photos for selected trip days
  useEffect(() => {
    if (!selected || !UNSPLASH_KEY) return;
    setDayPhotos({});
    const days = selected.itinerary?.days || [];
    days.forEach((day, i) => {
      // Only fetch for every other day to save API calls
      if (i % 2 !== 0) return;
      const query = day.locationName || day.title?.replace(/^Day \d+\s*[-—]\s*/,"") + " " + selected.destination;
      fetch("https://api.unsplash.com/photos/random?query="+encodeURIComponent(query)+"&orientation=landscape&client_id="+UNSPLASH_KEY)
        .then(r=>r.json())
        .then(data=>{
          if (data?.urls?.regular) {
            setDayPhotos(prev=>({ ...prev, [i]:{ url:data.urls.regular, credit:{ name:data.user?.name, link:data.user?.links?.html } } }));
          }
        }).catch(()=>{});
    });
  }, [selected]);

  function scrollToDay(dayIndex) {
    const ref = dayRefs.current[dayIndex];
    if (ref) ref.scrollIntoView({ behavior:"smooth", block:"center" });
  }

  async function deleteTrip(id) {
    setDeleting(id);
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) setError("Couldn't delete trip.");
    else { setTrips(prev=>prev.filter(t=>t.id!==id)); if (selected?.id===id) setSelected(null); }
    setDeleting(null);
  }

  const itinerary = selected?.itinerary;

  return (
    <div style={{ animation:"fadeUp 0.3s ease both" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem" }}>
        <button onClick={selected ? ()=>setSelected(null) : onClose}
          style={{ background:"none", border:"1.5px solid var(--sand)", borderRadius:"6px", padding:"0.35rem 0.85rem", fontSize:"0.76rem", cursor:"pointer", color:"var(--warm-mid)", fontFamily:"'DM Sans', sans-serif", whiteSpace:"nowrap" }}>
          {selected ? "← All trips" : "← Back"}
        </button>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.3rem", fontWeight:900, color:"var(--ink)", lineHeight:1 }}>
            {selected ? selected.destination : "My trips"}
          </div>
          {!selected && trips.length > 0 && (
            <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginTop:"0.2rem" }}>{trips.length} saved {trips.length===1?"trip":"trips"}</div>
          )}
        </div>
      </div>

      <div style={{ height:1, background:"var(--sand)", marginBottom:"1.25rem" }} />

      {error && <div style={{ background:"#fff1ed", border:"1px solid #f5c6b0", borderRadius:"8px", padding:"0.6rem 1rem", fontSize:"0.82rem", color:"var(--rust-dk)", marginBottom:"1rem" }}>{error}</div>}

      {loading && <div style={{ display:"flex", justifyContent:"center", padding:"3rem 0" }}><Spinner size={28} /></div>}

      {!loading && !selected && (
        <>
          {trips.length === 0 ? (
            <div style={{ textAlign:"center", padding:"3rem 1rem", color:"var(--warm-mid)" }}>
              <div style={{ fontSize:"2rem", marginBottom:"0.75rem" }}>🗺️</div>
              <div style={{ fontSize:"0.9rem" }}>No saved trips yet.</div>
              <div style={{ fontSize:"0.8rem", marginTop:"0.3rem" }}>Generate and save a trip to see it here.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
              {trips.map(trip=><TripCard key={trip.id} trip={trip} onOpen={()=>setSelected(trip)} />)}
            </div>
          )}
        </>
      )}

      {!loading && selected && itinerary && (
        <div>
          {/* Meta pills */}
          <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap", marginBottom:"1.25rem" }}>
            {[selected.origin&&"From "+selected.origin, selected.date_from&&selected.date_from+" to "+selected.date_to, selected.budget, selected.travel_style].filter(Boolean).map(tag=>(
              <span key={tag} style={{ padding:"0.22rem 0.65rem", background:"var(--sand)", borderRadius:"999px", fontSize:"0.72rem", color:"var(--ink)", fontWeight:500 }}>{tag}</span>
            ))}
          </div>

          {itinerary.intro && <p style={{ fontSize:"0.88rem", lineHeight:1.7, color:"var(--ink-soft)", marginBottom:"1.25rem" }}>{itinerary.intro}</p>}

          {/* Map */}
          <TripMap days={itinerary.days} onPinClick={scrollToDay} />

          <div style={{ height:1, background:"var(--sand)", marginBottom:"1.1rem" }} />

          <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem", marginBottom:"1.5rem" }}>
            {itinerary.days.map((day,i)=>(
              <DayCard
                key={i} day={day} index={i}
                displayNumber={getDayDisplayNumber(day.title,i)}
                photo={dayPhotos[i]}
                dayRef={el=>{ dayRefs.current[i]=el; }}
              />
            ))}
          </div>

          <button onClick={()=>deleteTrip(selected.id)} disabled={deleting===selected.id}
            style={{ width:"100%", padding:"0.75rem", background:"transparent", border:"1.5px solid #f5c6b0", borderRadius:"8px", color:"var(--rust-dk)", fontSize:"0.85rem", cursor:deleting===selected.id?"not-allowed":"pointer", fontFamily:"'DM Sans', sans-serif", transition:"background 0.15s", opacity:deleting===selected.id?0.6:1 }}
            onMouseOver={e=>e.currentTarget.style.background="#fff1ed"}
            onMouseOut={e=>e.currentTarget.style.background="transparent"}>
            {deleting===selected.id?"Deleting...":"Delete this trip"}
          </button>
        </div>
      )}
    </div>
  );
}
