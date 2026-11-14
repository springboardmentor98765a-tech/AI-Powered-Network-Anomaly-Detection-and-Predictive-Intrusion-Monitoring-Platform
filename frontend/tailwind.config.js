// NetShield AI — Tailwind theme (colours and fonts used across the dashboard)
// Developed by Krish | SKK Projects
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1A26",      // page background (night-shift SOC room)
        panel: "#15263A",    // cards and tables
        rule: "#25394F",     // borders
        fog: "#DCE6F0",      // main text
        muted: "#8DA2B8",    // secondary text
        signal: "#4FB3C9",   // primary actions, like a radar sweep
        sev: { low: "#7FB685", medium: "#E3B341", high: "#E8833A", critical: "#E5484D" },
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
