import React from "react";
import { ShieldCheck, ArrowRight, LogOut, Activity } from "lucide-react";

export default function Welcome({ user, onDashboard, onLogout }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080d1b",
        color: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "650px",
          padding: "48px",
          background: "#111a2e",
          border: "1px solid #24314d",
          borderRadius: "20px",
          textAlign: "center"
        }}
      >
        <ShieldCheck size={55} color="#38bdf8" />

        <h1 style={{ marginTop: "20px" }}>
          Welcome to NetShield AI
        </h1>

        <h2 style={{ color: "#38bdf8" }}>
          Hello, {user?.full_name || "Security Analyst"}!
        </h2>

        <p style={{ color: "#94a3b8" }}>
          Your secure authentication was successful.
        </p>

        <p style={{ color: "#94a3b8" }}>
          Access your network monitoring workspace to
          analyze traffic and monitor network security.
        </p>

        <div
          style={{
            marginTop: "35px",
            display: "flex",
            justifyContent: "center",
            gap: "15px",
            flexWrap: "wrap"
          }}
        >
          <button
            onClick={onDashboard}
            style={{
              padding: "14px 24px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <Activity size={18} />
            Enter Dashboard
            <ArrowRight size={18} />
          </button>

          <button
            onClick={onLogout}
            style={{
              padding: "14px 24px",
              background: "#1e293b",
              color: "white",
              border: "1px solid #334155",
              borderRadius: "10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </main>
  );
}