import { useEffect, useState } from 'react';

import { PUBLIC_STATS_URL } from '@/lib/site';

/**
 * Reads the number of completed scans from the public campaign snapshot.
 *
 * The snapshot is a static JSON served with a 10 minute cache, so this is a
 * single cached request per visitor rather than a live query to the worker.
 * Returns `null` while loading or when the snapshot is unavailable — callers
 * then render a dash instead of a stale hardcoded number.
 */
export function useScannedShops(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(PUBLIC_STATS_URL, { signal: controller.signal });
        if (!response.ok) return;

        const data: unknown = await response.json();
        const value = (data as { scanned_shops?: unknown } | null)?.scanned_shops;

        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          setCount(Math.floor(value));
        }
      } catch {
        // Snapshot unreachable — keep the dash rather than invent a number.
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return count;
}

/** Formats the snapshot value for display, falling back to a dash. */
export function formatScannedShops(count: number | null): string {
  return count === null ? '—' : count.toLocaleString('cs-CZ');
}