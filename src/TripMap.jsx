// src/TripMap.jsx
// Interactive Mapbox map showing day-by-day pins for the itinerary
import { useEffect, useRef, useState } from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function TripMap({ days }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState(false);
  const [active, setActive]   = useState(null); // active pin index

  // Filter days that have valid coordinates
  const pins = (days || [])
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => d.lat && d.lng && !isNaN(d.lat) && !isNaN(d.lng));

  useEffect(() => {
    if (!MAPBOX_TOKEN || pins.length === 0) return;

    // Dynamically load mapbox-gl
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
    document.head.appendChild(link);

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
    if (!containerRef.current || pins.length === 0) return;
    try {
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      // Calculate bounds from all pins
      const lngs = pins.map(p => p.lng);
      const lats = pins.map(p => p.lat);
      const bounds = [
        [Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5],
        [Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5],
      ];

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        bounds: bounds,
        fitBoundsOptions: { padding: 50 },
      });

      mapRef.current = map;

      map.on("load", () => {
        setLoaded(true);

        // Draw route line between pins
        if (pins.length > 1) {
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: pins.map(p => [p.lng, p.lat]),
              },
            },
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            paint: {
              "line-color": "#c4622d",
              "line-width": 2,
              "line-dasharray": [2, 2],
              "line-opacity": 0.6,
            },
          });
        }

        // Add pins
        pins.forEach((pin, i) => {
          const el = document.createElement("div");
          const isGetThere = pin.title?.toLowerCase().includes("getting there") || pin.title?.toLowerCase().includes("day 0");
          const isGetHome  = pin.title?.toLowerCase().includes("getting home");
          const label = isGetThere ? "✈" : isGetHome ? "🏠" : String(i + (isGetThere ? 0 : 1)).padStart(2, "0");

          el.style.cssText = `
            width: 32px; height: 32px; border-radius: 50%;
            background: ${i === 0 ? "#1a1510" : "#c4622d"};
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: ${isGetThere || isGetHome ? "14px" : "10px"};
            font-weight: 700; font-family: 'DM Sans', sans-serif;
            cursor: pointer; transition: transform 0.15s;
          `;
          el.textContent = label;
          el.onmouseenter = () => { el.style.transform = "scale(1.2)"; setActive(pin.index); };
          el.onmouseleave = () => { el.style.transform = "scale(1)"; setActive(null); };

          new mapboxgl.Marker({ element: el })
            .setLngLat([pin.lng, pin.lat])
            .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false })
              .setHTML(`<div style="font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;color:#1a1510;max-width:160px">${pin.locationName || pin.title?.replace(/^Day \d+\s*[-—]\s*/,"") || "Stop"}</div>`))
            .addTo(map);
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      });

    } catch(e) {
      console.error("Map init error:", e);
      setError(true);
    }
  }

  if (!MAPBOX_TOKEN || pins.length === 0) return null;
  if (error) return null;

  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>
        Trip map
      </div>
      <div style={{ position:"relative", borderRadius:"12px", overflow:"hidden", border:"1px solid var(--sand)", height:"280px", background:"var(--sand)" }}>
        {!loaded && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", border:"3px solid #e0d5bf", borderTopColor:"#c4622d", animation:"spin 0.8s linear infinite" }} />
          </div>
        )}
        <div ref={containerRef} style={{ width:"100%", height:"100%", opacity:loaded?1:0, transition:"opacity 0.4s" }} />
      </div>
      {/* Day legend */}
      <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop:"0.6rem" }}>
        {pins.slice(0, 8).map((pin, i) => (
          <div key={i}
            style={{ display:"flex", alignItems:"center", gap:"0.3rem", padding:"0.2rem 0.55rem", background: active===pin.index ? "#fff8f5" : "var(--white)", border:"1px solid", borderColor: active===pin.index ? "var(--rust)" : "var(--sand)", borderRadius:"999px", fontSize:"0.7rem", color:"var(--ink-soft)", transition:"all 0.15s", cursor:"default" }}
            onMouseEnter={()=>setActive(pin.index)} onMouseLeave={()=>setActive(null)}>
            <span style={{ width:14, height:14, borderRadius:"50%", background:i===0?"var(--ink)":"var(--rust)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:"8px", fontWeight:700, flexShrink:0 }}>
              {i===0?"✈":i+1}
            </span>
            <span style={{ maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {pin.locationName || pin.title?.replace(/^Day \d+\s*[-—]\s*/,"") || "Stop"}
            </span>
          </div>
        ))}
        {pins.length > 8 && <div style={{ fontSize:"0.7rem", color:"var(--warm-mid)", padding:"0.2rem 0.4rem" }}>+{pins.length-8} more</div>}
      </div>
    </div>
  );
}
