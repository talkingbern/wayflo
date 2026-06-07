// src/TripMap.jsx
import { useEffect, useRef, useState, useCallback } from "react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function TripMap({ days, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState(false);
  const [active, setActive]   = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const pins = (days || [])
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => d.lat && d.lng && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lng)));

  const flyToPin = useCallback((pin) => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.flyTo({
      center: [parseFloat(pin.lng), parseFloat(pin.lat)],
      zoom: 13,
      duration: 1200,
      essential: true,
    });
  }, [mapReady]);

  function handlePinClick(pin) {
    setActive(pin.index);
    flyToPin(pin);
    if (onPinClick) onPinClick(pin.index);
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || pins.length === 0 || mapRef.current) return;

    const existingLink = document.querySelector('link[href*="mapbox-gl"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[src*="mapbox-gl"]');
    if (existingScript) {
      if (window.mapboxgl) initMap();
      return;
    }

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
      const lats = pins.map(p => parseFloat(p.lat));
      const pad  = pins.length === 1 ? 0.05 : 0.5;
      const bounds = [
        [Math.min(...lngs) - pad, Math.min(...lats) - pad],
        [Math.max(...lngs) + pad, Math.max(...lats) + pad],
      ];

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
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: pins.map(p => [parseFloat(p.lng), parseFloat(p.lat)]) },
            },
          });
          map.addLayer({ id:"route", type:"line", source:"route", paint:{ "line-color":"#c4622d", "line-width":2, "line-dasharray":[2,2], "line-opacity":0.55 } });
        }

        pins.forEach((pin, i) => {
          const el = document.createElement("div");
          const isGetThere = pin.title?.toLowerCase().includes("getting there") || i === 0;
          const isGetHome  = pin.title?.toLowerCase().includes("getting home") || i === pins.length - 1;
          const label = isGetThere ? "✈" : isGetHome ? "🏠" : String(i).padStart(2,"0");

          el.style.cssText = `
            width:30px;height:30px;border-radius:50%;
            background:${i===0?"#1a1510":"#c4622d"};
            border:2.5px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            color:white;font-size:${isGetThere||isGetHome?"13px":"10px"};
            font-weight:700;font-family:'DM Sans',sans-serif;
            cursor:pointer;transition:transform 0.15s, box-shadow 0.15s;
          `;
          el.textContent = label;
          el.onclick = () => handlePinClick(pin);
          el.onmouseenter = () => { el.style.transform="scale(1.25)"; el.style.boxShadow="0 3px 12px rgba(196,98,45,0.4)"; };
          el.onmouseleave = () => { el.style.transform="scale(1)"; el.style.boxShadow="0 2px 8px rgba(0,0,0,0.25)"; };

          const popup = new mapboxgl.Popup({ offset:20, closeButton:false, maxWidth:"180px" })
            .setHTML(`<div style="font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#1a1510;padding:2px 0">${pin.locationName || pin.title?.replace(/^Day \d+\s*[-—]\s*/,"") || "Stop"}</div>`);

          const marker = new mapboxgl.Marker({ element:el })
            .setLngLat([parseFloat(pin.lng), parseFloat(pin.lat)])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass:false }), "top-right");
      });
    } catch(e) {
      console.error("Map error:", e);
      setError(true);
    }
  }

  if (!MAPBOX_TOKEN || pins.length === 0 || error) return null;

  return (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ fontSize:"0.62rem", letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--warm-mid)", marginBottom:"0.5rem" }}>Trip map</div>
      <div style={{ position:"relative", borderRadius:"12px", overflow:"hidden", border:"1px solid var(--sand)", height:"280px", background:"var(--sand)" }}>
        {!loaded && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", border:"3px solid #e0d5bf", borderTopColor:"#c4622d", animation:"spin 0.8s linear infinite" }} />
          </div>
        )}
        <div ref={containerRef} style={{ width:"100%", height:"100%", opacity:loaded?1:0, transition:"opacity 0.4s" }} />
      </div>
      {/* Clickable legend */}
      <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop:"0.6rem" }}>
        {pins.map((pin, i) => (
          <button key={i} type="button"
            onClick={() => handlePinClick(pin)}
            style={{ display:"flex", alignItems:"center", gap:"0.3rem", padding:"0.22rem 0.6rem", background:active===pin.index?"#fff8f5":"var(--white)", border:"1px solid", borderColor:active===pin.index?"var(--rust)":"var(--sand)", borderRadius:"999px", fontSize:"0.7rem", color:active===pin.index?"var(--rust)":"var(--ink-soft)", transition:"all 0.15s", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}
            onMouseEnter={()=>setActive(pin.index)} onMouseLeave={()=>setActive(null)}>
            <span style={{ width:14, height:14, borderRadius:"50%", background:i===0?"var(--ink)":"var(--rust)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:"8px", fontWeight:700, flexShrink:0 }}>
              {i===0?"✈":i}
            </span>
            <span style={{ maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {pin.locationName || pin.title?.replace(/^Day \d+\s*[-—]\s*/,"") || "Stop"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
