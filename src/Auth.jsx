// src/Auth.jsx
// Modal for sign up / sign in — email + password only
import { useState } from "react";
import { supabase } from "./supabaseClient";

const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(26,21,16,0.55)",
  backdropFilter: "blur(3px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: "1rem",
  animation: "fadeIn 0.2s ease both",
};

const card = {
  background: "#faf7f2",
  border: "1px solid #e0d5bf",
  borderRadius: "14px",
  padding: "2rem 1.75rem",
  width: "100%", maxWidth: "400px",
  fontFamily: "'DM Sans', sans-serif",
  animation: "fadeUp 0.25s ease both",
};

const inputStyle = {
  width: "100%",
  padding: "0.72rem 1rem",
  background: "#fff",
  border: "1.5px solid #e0d5bf",
  borderRadius: "8px",
  fontSize: "0.92rem",
  color: "#1a1510",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  marginBottom: "0.75rem",
  boxSizing: "border-box",
};

export default function Auth({ onClose }) {
  const [mode, setMode]       = useState("signin"); // signin | signup | reset
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");

  async function handleSubmit() {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email for a confirmation link.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose(); // session triggers onAuthStateChange in App
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage("Password reset email sent — check your inbox.");
      }
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setLoading(false);
  }

  const titles = { signin: "Welcome back", signup: "Create account", reset: "Reset password" };
  const ctas   = { signin: "Sign in", signup: "Sign up", reset: "Send reset email" };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 900, color: "#1a1510", marginBottom: "0.25rem" }}>
            {titles[mode]}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#9a8870" }}>
            {mode === "signup" ? "First trip is on us." : mode === "reset" ? "We'll send you a link." : "Good to see you again."}
          </div>
        </div>

        {/* Fields */}
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          style={inputStyle}
          autoFocus
        />
        {mode !== "reset" && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ ...inputStyle, marginBottom: "0.25rem" }}
          />
        )}

        {/* Forgot password link */}
        {mode === "signin" && (
          <div style={{ textAlign: "right", marginBottom: "1rem" }}>
            <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }}
              style={{ background: "none", border: "none", fontSize: "0.76rem", color: "#9a8870", cursor: "pointer", textDecoration: "underline" }}>
              Forgot password?
            </button>
          </div>
        )}

        {/* Error / success */}
        {error   && <div style={{ fontSize: "0.8rem", color: "#9e4a1f", marginBottom: "0.75rem", background: "#fff1ed", padding: "0.5rem 0.75rem", borderRadius: "6px" }}>{error}</div>}
        {message && <div style={{ fontSize: "0.8rem", color: "#4a7c5e", marginBottom: "0.75rem", background: "#edf7f1", padding: "0.5rem 0.75rem", borderRadius: "6px" }}>{message}</div>}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "0.78rem",
            background: loading ? "#9a8870" : "#c4622d",
            border: "none", borderRadius: "8px",
            color: "#fff", fontSize: "0.92rem", fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: "1rem", transition: "background 0.2s",
          }}
        >
          {loading ? "Please wait…" : ctas[mode]}
        </button>

        {/* Mode switcher */}
        <div style={{ textAlign: "center", fontSize: "0.8rem", color: "#9a8870" }}>
          {mode === "signin" && <>No account?{" "}
            <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
              style={{ background: "none", border: "none", color: "#c4622d", cursor: "pointer", fontWeight: 500, fontSize: "0.8rem" }}>Sign up free</button>
          </>}
          {mode === "signup" && <>Already have an account?{" "}
            <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }}
              style={{ background: "none", border: "none", color: "#c4622d", cursor: "pointer", fontWeight: 500, fontSize: "0.8rem" }}>Sign in</button>
          </>}
          {mode === "reset" && <>
            <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }}
              style={{ background: "none", border: "none", color: "#c4622d", cursor: "pointer", fontWeight: 500, fontSize: "0.8rem" }}>← Back to sign in</button>
          </>}
        </div>
      </div>
    </div>
  );
}
