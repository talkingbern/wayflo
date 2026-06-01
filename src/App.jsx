import { useState, useRef } from "react";

// ─── Styles ───────────────────────────────────────────────────────────────────
const FONT_INJECT = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink:      #1a1510;
    --paper:    #f5f0e8;
    --sand:     #e8dfc8;
    --rust:     #c4622d;
    --rust-dk:  #9e4a1f;
    --sage:     #6b7c5e;
    --warm-mid: #a89880;
    --card-bg:  #faf7f2;
  }

  html { font-size: 16px; }

  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-weight: 400;
    min-height: 100vh;
    overflow-x: hidden;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.5;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(196,98,45,0.35); }
    70%  { box-shadow: 0 0 0 10px rgba(196,98,45,0); }
    100% { box-shadow: 0 0 0 0 rgba(196,98,45,0); }
  }
`;

// ─── Sample data for Randomize ────────────────────────────────────────────────
const DESTINATIONS = [
  "Southeast Asia (Thailand, Vietnam, Cambodia)",
  "Balkan Peninsula (Serbia, Bosnia, Albania)",
  "Morocco & Portugal",
  "Peru & Bolivia",
  "Japan on a budget",
  "Eastern Europe (Poland, Czech Republic, Hungary)",
  "Colombia & Ecuador",
  "Indonesia (Bali, Lombok, Java)",
];
const STYLES = ["Solo adventure", "Group travel", "Slow travel", "Fast-paced explorer", "Off the beaten path"];
const INTERESTS_OPTIONS = [
  "Street food & local markets",
  "Hiking & nature",
  "History & culture",
  "Nightlife & socialising",
  "Art & architecture",
  "Beaches & swimming",
  "Photography",
  "Volunteering",
];
const BUDGETS = ["$20/day", "$35/day", "$50/day", "$75/day"];

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomDates() {
  const start = new Date(Date.now() + 1000 * 60 * 60 * 24 * (Math.floor(Math.random() * 60) + 14));
  const end   = new Date(start.getTime() + 1000 * 60 * 60 * 24 * (Math.floor(Math.random() * 18) + 5));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <div style={{ fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--warm-mid)", marginBottom: "0.4rem" }}>
    {children}
  </div>
);

const inputStyle = {
  width: "100%",
  padding: "0.75rem 1rem",
  background: "var(--paper)",
  border: "1.5px solid var(--sand)",
  borderRadius: "6px",
  fontSize: "0.95rem",
  color: "var(--ink)",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  transition: "border-color 0.2s",
};

function StyledInput({ style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...(focused ? { borderColor: "var(--rust)" } : {}), ...style }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function StyledSelect({ style, children, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      style={{
        ...inputStyle,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a89880' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "calc(100% - 12px) center",
        cursor: "pointer",
        ...(focused ? { borderColor: "var(--rust)" } : {}),
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </select>
  );
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.4rem 0.85rem",
        borderRadius: "999px",
        border: "1.5px solid",
        borderColor: selected ? "var(--rust)" : "var(--sand)",
        background: selected ? "var(--rust)" : "transparent",
        color: selected ? "#fff" : "var(--warm-mid)",
        fontSize: "0.8rem",
        fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer",
        transition: "all 0.18s",
        fontWeight: selected ? 500 : 400,
      }}
    >
      {label}
    </button>
  );
}

function DayCard({ day, index }) {
  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--sand)",
      borderRadius: "10px",
      padding: "1.25rem 1.5rem",
      animation: "fadeUp 0.4s ease both",
      animationDelay: `${index * 0.06}s`,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 900, color: "var(--rust)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ fontWeight: 500, fontSize: "1rem" }}>{day.title || `Day ${index + 1}`}</span>
      </div>
      <div style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", lineHeight: 1.7, color: "#3a3028" }}>
        {day.content}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [destination, setDestination] = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [budget, setBudget]           = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [interests, setInterests]     = useState([]);

  const [phase, setPhase]       = useState("form");   // form | loading | result
  const [itinerary, setItinerary] = useState(null);
  const [rawText, setRawText]   = useState("");

  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining]             = useState(false);

  const [error, setError] = useState("");

  // ── Ref-based guard: prevents any concurrent or double-fire requests ────────
  const requestInFlight = useRef(false);

  function toggleInterest(item) {
    setInterests(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  function randomize() {
    const { from, to } = randomDates();
    setDestination(randomPick(DESTINATIONS));
    setDateFrom(from);
    setDateTo(to);
    setBudget(randomPick(BUDGETS));
    setTravelStyle(randomPick(STYLES));
    const shuffled = [...INTERESTS_OPTIONS].sort(() => Math.random() - 0.5);
    setInterests(shuffled.slice(0, Math.floor(Math.random() * 2) + 2));
  }

  function parseItinerary(text) {
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return { intro: "", days: [{ title: "Your Itinerary", content: text }] };
    }
  }

  // ── Shared fetch wrapper — always calls /api/generate ─────────────────────
  async function callGenerateEndpoint(body) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    const data = await res.json();
    return data.raw; // raw text from Anthropic
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function generate() {
    if (!destination || !dateFrom || !dateTo || !budget || !travelStyle) {
      setError("Please fill in all fields before generating.");
      return;
    }
    // Hard guard — ref prevents race conditions even if state hasn't updated yet
    if (requestInFlight.current) return;
    requestInFlight.current = true;

    setError("");
    setPhase("loading");

    try {
      const text = await callGenerateEndpoint({
        destination, dateFrom, dateTo, budget, travelStyle, interests,
      });
      setRawText(text);
      setItinerary(parseItinerary(text));
      setPhase("result");
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      setPhase("form");
    } finally {
      requestInFlight.current = false;
    }
  }

  // ── Refine ────────────────────────────────────────────────────────────────
  async function refine() {
    if (!refineFeedback.trim()) return;
    if (requestInFlight.current) return;
    requestInFlight.current = true;

    setRefining(true);
    setError("");

    try {
      const text = await callGenerateEndpoint({
        destination, dateFrom, dateTo, budget, travelStyle, interests,
        refineFeedback,
        previousItinerary: rawText,
      });
      setRawText(text);
      setItinerary(parseItinerary(text));
      setRefineFeedback("");
    } catch (e) {
      setError(e.message || "Refinement failed. Try again.");
    } finally {
      setRefining(false);
      requestInFlight.current = false;
    }
  }

  // ── Derived UI flags ───────────────────────────────────────────────────────
  const isLoading      = phase === "loading";
  const generateBusy   = isLoading; // button disabled state
  const refineBusy     = refining || !refineFeedback.trim();

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONT_INJECT}</style>

      {/* Header */}
      <header style={{
        padding: "1.5rem 1.5rem 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: "680px",
        margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 900, color: "var(--rust)" }}>
            Wayflo
          </span>
          <span style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--warm-mid)" }}>
            Budget travel planner
          </span>
        </div>
        {phase === "result" && (
          <button
            onClick={() => { setPhase("form"); setItinerary(null); setError(""); }}
            style={{
              background: "none",
              border: "1.5px solid var(--sand)",
              borderRadius: "6px",
              padding: "0.4rem 0.9rem",
              fontSize: "0.78rem",
              cursor: "pointer",
              color: "var(--warm-mid)",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            ← New trip
          </button>
        )}
      </header>

      <main style={{ maxWidth: "680px", margin: "0 auto", padding: "1.5rem" }}>

        {/* ── FORM ─────────────────────────────────────────────────────────── */}
        {phase === "form" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ marginBottom: "2rem" }}>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2rem, 7vw, 3rem)",
                fontWeight: 900,
                lineHeight: 1.1,
                color: "var(--ink)",
                marginBottom: "0.6rem",
              }}>
                Where are you<br />
                <span style={{ color: "var(--rust)" }}>running off to?</span>
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--warm-mid)", lineHeight: 1.6 }}>
                Answer five quick questions and we'll build your perfect backpacker itinerary.
              </p>
            </div>

            <div style={{ height: "1px", background: "var(--sand)", marginBottom: "1.75rem" }} />

            <div style={{ marginBottom: "1.4rem" }}>
              <Label>01 — Destination</Label>
              <StyledInput
                type="text"
                placeholder="e.g. Vietnam & Cambodia, 3 weeks"
                value={destination}
                onChange={e => setDestination(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: "1.4rem" }}>
              <Label>02 — Travel Dates</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--warm-mid)", marginBottom: "0.3rem" }}>From</div>
                  <StyledInput type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--warm-mid)", marginBottom: "0.3rem" }}>To</div>
                  <StyledInput type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "1.4rem" }}>
              <Label>03 — Daily Budget</Label>
              <StyledSelect value={budget} onChange={e => setBudget(e.target.value)}>
                <option value="">Select your daily budget</option>
                {BUDGETS.map(b => <option key={b}>{b}</option>)}
              </StyledSelect>
            </div>

            <div style={{ marginBottom: "1.4rem" }}>
              <Label>04 — Travel Style</Label>
              <StyledSelect value={travelStyle} onChange={e => setTravelStyle(e.target.value)}>
                <option value="">How do you like to travel?</option>
                {STYLES.map(s => <option key={s}>{s}</option>)}
              </StyledSelect>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <Label>05 — Interests</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {INTERESTS_OPTIONS.map(item => (
                  <Chip
                    key={item}
                    label={item}
                    selected={interests.includes(item)}
                    onClick={() => toggleInterest(item)}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div style={{
                background: "#fff1ed",
                border: "1px solid #f5c6b0",
                borderRadius: "6px",
                padding: "0.65rem 1rem",
                fontSize: "0.83rem",
                color: "var(--rust-dk)",
                marginBottom: "1rem",
              }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                onClick={randomize}
                disabled={generateBusy}
                style={{
                  flex: "0 0 auto",
                  padding: "0.75rem 1.25rem",
                  background: "transparent",
                  border: "1.5px solid var(--sand)",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  cursor: generateBusy ? "not-allowed" : "pointer",
                  color: "var(--warm-mid)",
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: generateBusy ? 0.5 : 1,
                }}
              >
                🎲 Randomize
              </button>

              {/* ── Generate button — disabled while in-flight ─────────────── */}
              <button
                onClick={generate}
                disabled={generateBusy}
                aria-busy={generateBusy}
                style={{
                  flex: "1 1 180px",
                  padding: "0.75rem 1.5rem",
                  background: generateBusy ? "var(--warm-mid)" : "var(--rust)",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  cursor: generateBusy ? "not-allowed" : "pointer",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: "0.03em",
                  animation: generateBusy ? "none" : "pulse-ring 2.5s infinite",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {generateBusy ? (
                  <>
                    <span style={{
                      width: "14px", height: "14px",
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                      flexShrink: 0,
                    }} />
                    Generating…
                  </>
                ) : "Generate my itinerary →"}
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ──────────────────────────────────────────────────────── */}
        {phase === "loading" && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: "1.25rem",
            animation: "fadeUp 0.3s ease both",
          }}>
            <div style={{
              width: "42px", height: "42px",
              borderRadius: "50%",
              border: "3px solid var(--sand)",
              borderTopColor: "var(--rust)",
              animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                Plotting your adventure…
              </div>
              <div style={{ fontSize: "0.83rem", color: "var(--warm-mid)" }}>
                Finding hidden gems, cheap eats, and the best routes.
              </div>
            </div>
          </div>
        )}

        {/* ── RESULT ───────────────────────────────────────────────────────── */}
        {phase === "result" && itinerary && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ marginBottom: "1.75rem" }}>
              <div style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--warm-mid)", marginBottom: "0.4rem" }}>
                Your itinerary
              </div>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.5rem, 5vw, 2.2rem)",
                fontWeight: 900,
                lineHeight: 1.15,
                marginBottom: "0.75rem",
              }}>
                {destination}
              </h2>
              {itinerary.intro && (
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#4a3f34" }}>
                  {itinerary.intro}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
                {[dateFrom && `${dateFrom} → ${dateTo}`, budget, travelStyle].filter(Boolean).map(tag => (
                  <span key={tag} style={{
                    padding: "0.25rem 0.7rem",
                    background: "var(--sand)",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    color: "var(--ink)",
                    fontWeight: 500,
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            <div style={{ height: "1px", background: "var(--sand)", marginBottom: "1.5rem" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
              {itinerary.days.map((day, i) => (
                <DayCard key={i} day={day} index={i} />
              ))}
            </div>

            <button
              style={{
                width: "100%",
                padding: "0.85rem",
                background: "var(--ink)",
                border: "none",
                borderRadius: "8px",
                color: "#f5f0e8",
                fontSize: "0.95rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: "1rem",
                transition: "opacity 0.2s",
              }}
              onMouseOver={e => e.currentTarget.style.opacity = "0.85"}
              onMouseOut={e => e.currentTarget.style.opacity = "1"}
            >
              Save this trip
            </button>

            {/* ── Refine ─────────────────────────────────────────────────── */}
            <div style={{
              background: "var(--card-bg)",
              border: "1px solid var(--sand)",
              borderRadius: "10px",
              padding: "1.25rem",
            }}>
              <div style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--warm-mid)", marginBottom: "0.6rem" }}>
                Refine your itinerary
              </div>
              <p style={{ fontSize: "0.82rem", color: "#7a6a5a", marginBottom: "0.9rem", lineHeight: 1.6 }}>
                Not quite right? Tell us what to change and we'll regenerate.
              </p>
              <textarea
                placeholder="e.g. Add more beach days, remove the museum on day 3, I prefer street food over restaurants…"
                value={refineFeedback}
                onChange={e => setRefineFeedback(e.target.value)}
                disabled={refining}
                rows={3}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  marginBottom: "0.75rem",
                  lineHeight: 1.6,
                  fontSize: "0.88rem",
                  opacity: refining ? 0.6 : 1,
                }}
              />
              {error && (
                <div style={{ fontSize: "0.8rem", color: "var(--rust-dk)", marginBottom: "0.6rem" }}>{error}</div>
              )}
              <button
                onClick={refine}
                disabled={refineBusy}
                aria-busy={refining}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: refineBusy ? "var(--sand)" : "var(--rust)",
                  border: "none",
                  borderRadius: "7px",
                  color: refineBusy ? "var(--warm-mid)" : "#fff",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: refineBusy ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                {refining ? (
                  <>
                    <span style={{
                      width: "14px", height: "14px",
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                      flexShrink: 0,
                    }} />
                    Regenerating…
                  </>
                ) : "↻ Regenerate itinerary"}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--warm-mid)", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
        WAYFLO — First trip free · $5/trip after that
      </footer>
    </>
  );
}
