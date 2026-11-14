// NetShield AI — Re-runs a loader every few seconds to keep pages 'live'
// Developed by Krish | SKK Projects
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function usePolling(loader, intervalMs = 5000, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refresh = useCallback(async () => {
    try {
      setData(await loaderRef.current());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!enabled) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs, enabled]);

  return { data, error, refresh };
}
