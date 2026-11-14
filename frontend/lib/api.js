// NetShield AI — Talks to the FastAPI backend (adds the login token to every request)
// Developed by Krish | SKK Projects
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken() {
  return typeof window === "undefined" ? null : localStorage.getItem("ns_token");
}

export function getUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("ns_user")); } catch { return null; }
}

export function saveSession(token, user) {
  localStorage.setItem("ns_token", token);
  localStorage.setItem("ns_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("ns_token");
  localStorage.removeItem("ns_user");
}

// Main helper: api("/api/alerts"), api("/api/alerts/3", { method: "PATCH", body: {...} })
export async function api(path, { method = "GET", body, form, text = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method, headers, body: form ? form : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && path !== "/api/auth/login") {
    clearSession();
    window.location.href = "/";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {}
    throw new Error(detail);
  }
  return text ? res.text() : res.json();
}

// Role check helper: can(user, "analyst") is true for analysts and admins
const LEVEL = { viewer: 1, analyst: 2, admin: 3 };
export const can = (user, role) => !!user && LEVEL[user.role] >= LEVEL[role];

// Backend stores UTC time without a 'Z' — add it so the browser shows local time
export const toDate = (iso) => new Date(/([zZ]|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}Z`);
export const fmtTime = (iso) => toDate(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const fmtDateTime = (iso) => toDate(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function downloadText(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
