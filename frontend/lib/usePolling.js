
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function usePolling(loader, intervalMs = 5000, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refresh = useCallback(async () => {
    try {
      const result = await loaderRef.current();
      setData(result);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load data.");
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
