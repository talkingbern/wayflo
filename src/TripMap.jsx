// src/TripMap.jsx
import { useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Detect transport icon from transportType field or content fallback
function getTransportIcon(day, isFirst, isLast) {
  if (isLast) return "🏠";
  const type = (day.transportType || "").toLowerCase();
  const content = (day.content || "").toLowerCase();
  if (type === "flight" || (!type && isFirst && (content.includes("fly") || content.includes("flight") || content.includes("airport")))) return "✈";
  if (type === "train" || (!type && (content.includes("train") || content.includes("rail")))) return "🚂";
  if (type === "bus" || (!type && (content.includes("bus") || content.includes("coach")))) return "🚌";
  if (type === "ferry" || (!type && (content.includes("ferry") || content.includes("boat")))) return "⛴";
  if (type === "drive" || (!type && (content.includes("drive") || content.includes("car")))) return "🚗";
  if (isFirst) return "✈"; // default first day
  return null; // regular day — use number
}

export default function TripMap({ days, onPinClick }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const [loaded, setLoaded]     = useState(false);
  const [error, setError]       = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [activePin, setActivePin] = useState(null); // index of active pin

  const pins = (days || [])
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => d.lat && d.lng && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lng)));

  function flyToPin(pin) {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.flyTo({
      center: [parseFloat(pin.lng), parseFloat(pin.lat)],
      zoom: 12,
      duration: 1000,
      essential: true,
    });
  }

  function handlePinClick(pin) {
    setActivePin(pin.index === activePin ? null : pin.index);
    flyToPin(pin);
    if (onPinClick) onPinClick(pin.index);
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || pins.length === 0 || mapRef.current) return;

    if (!document.querySelector('link[href*="mapbox-gl"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
      document.head.appendChild(link);
    }

    if (window.mapboxgl) { initMap(); return; }

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
    script.onload = () => initMap();
    script.onerror = () => setError(true);
    document.head.appendChild(script);

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  function initMap() {
    if (!containerRef.current || pins.length === 0 || mapRef.current) return;
    try {
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const lngs = pins.map(p => parseFloat(p.lng));
      const lats  = pins.map(p => parseFloat(p.lat));
      const pad   = pins.length === 1 ? 0.05 : 0.5;
      const bounds = [[Math.min(...lngs)-pad, Math.min(...lats)-pad],[Math.max(...lngs)+pad, Math.max(...lats)+pad]];

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        bounds,
        fitBoundsOptions: { padding: 50 },
      });
      mapRef.current = map;

      map.on("load", () => {
        setMapReady(true);
        setLoaded(true);

        if (pins.length > 1) {
          map.addSource("route", { type:"geojson", data:{ type:"Feature", geometry:{ type:"LineString", coordinates:pins.map(p=>[parseFloat(p.lng),parseFloat(p.lat)]) } } });
          map.addLayer({ id:"route", type:"line", source:"route", paint:{ "line-color":"#c4622d", "line-width":2, "line-dasharray":[2,2], "line-opacity":0.55 } });
        }

        pins.forEach((pin, i) => {
          const isFirst = i === 0;
          const isLast  = i === pins.length - 1;
          const icon    = getTransportIcon(pin, isFirst, isLast);
          const isSpecial = icon !== null;

          const el = document.createElement("div");
          el.style.cssText = `
            width:30px;height:30px;border-radius:50%;
            background:${isFirst?"#1a1510":"#c4622d"};
            border:2.5px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:${isSpecial?"13px":"10px"};
            font-weight:700;font-family:'DM Sans',sans-serif;
            cursor:pointer;transition:transform 0.15s, box-shadow 0.15s;
          `;
          el.textContent = isSpecial ? icon : String(i).padStart(2,"0");
          el.onclick = () => handlePinClick(pin);
          el.onmouseenter = () => { el.style.transform="scale(1.25)"; el.style.boxShadow="0 3px 12px rgba(196,98,45,0.4)"; };
          el.onmouseleave = () => { el.style.transform="scale(1)"; el.style.boxShadow="0 2px 8px rgba(0,0,0,0.25)"; };

          new mapboxgl.Marker({ element:el })
            .setLngLat([parseFloat(pin.lng), parseFloat(pin.lat)])
            .addTo(map);
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass:false }), "top-right");
      });
    } catch(e) {
      console.error("Map error:", e);
      setError(true);
    }
  }

  if (!MAPBOX_TOKEN || pins.length === 0 || error) return null;

  const activePinData = activePin !== null ? pins.find(p => p.index === activePin) : null;
  const activeDayData = activePin !== null ? (days || [])[activePin] : null;

  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>Trip map</div>

      {/* Map */}
      <div style={{ position:"relative", borderRadius:"12px", overflow:"hidden", border:"1px solid var(--sand)", height:"260px", background:"var(--sand)" }}>
        {!loaded && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", border:"3px solid #e0d5bf", borderTopColor:"#c4622d", animation:"spin 0.8s linear infinite" }} />
          </div>
        )}
        <div ref={containerRef} style={{ width:"100%", height:"100%", opacity:loaded?1:0, transition:"opacity 0.4s" }} />
      </div>

      {/* Inline day panel — appears below map when a pin is clicked */}
      {activeDayData && (
        <div style={{ background:"var(--white)", border:"1px solid var(--rust)", borderTop:"none", borderRadius:"0 0 12px 12px", padding:"0.9rem 1.1rem", animation:"fadeUp 0.2s ease both" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:"0.5rem" }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:"0.5rem" }}>
              <span style={{ fontFamily:"'Playfair Display', serif", fontSize:"1.1rem", fontWeight:900, color:"var(--rust)" }}>
                {String(activePin).padStart(2,"0")}
              </span>
              <span style={{ fontWeight:600, fontSize:"0.88rem", color:"var(--ink)" }}>
                {activeDayData.title.replace(/^Day \d+\s*[-—]\s*/,"")}
              </span>
            </div>
            <button onClick={()=>setActivePin(null)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--warm-mid)", fontSize:"1rem", lineHeight:1, padding:"0 0.2rem" }}>
              ×
            </button>
          </div>
          {activePinData?.locationName && (
            <div style={{ fontSize:"0.72rem", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>📍 {activePinData.locationName}</div>
          )}
          <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:"0.3rem" }}>
            {activeDayData.content.split("\n").map(l=>l.replace(/^[*\-•] ?/,"").trim()).filter(Boolean).map((b,i)=>(
              <li key={i} style={{ display:"flex", gap:"0.45rem", fontSize:"0.81rem", lineHeight:1.5, color:"var(--ink-soft)" }}>
                <span style={{ color:"var(--rust)", flexShrink:0 }}>→</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scrollable legend pills */}
      <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop: activeDayData ? "0.75rem" : "0.6rem" }}>
        {pins.map((pin, i) => {
          const isFirst = i === 0;
          const isLast  = i === pins.length - 1;
          const icon    = getTransportIcon(pin, isFirst, isLast);
          const isActive = activePin === pin.index;
          return (
            <button key={i} type="button" onClick={()=>handlePinClick(pin)}
              style={{ display:"flex", alignItems:"center", gap:"0.3rem", padding:"0.22rem 0.6rem", background:isActive?"#fff8f5":"var(--white)", border:"1px solid", borderColor:isActive?"var(--rust)":"var(--sand)", borderRadius:"999px", fontSize:"0.7rem", color:isActive?"var(--rust)":"var(--ink-soft)", transition:"all 0.15s", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              <span style={{ width:14, height:14, borderRadius:"50%", background:isFirst?"var(--ink)":"var(--rust)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:"8px", fontWeight:700, flexShrink:0 }}>
                {icon || i}
              </span>
              <span style={{ maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {pin.locationName || pin.title?.replace(/^Day \d+\s*[-—]\s*/,"") || "Stop"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
