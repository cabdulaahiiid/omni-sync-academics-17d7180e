const KEY = "tvet:favorites";

export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(to: string): string[] {
  const list = getFavorites();
  const next = list.includes(to) ? list.filter((x) => x !== to) : [...list, to];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("tvet:favorites"));
  } catch {
    /* ignore */
  }
  return next;
}

export function isFavorite(to: string): boolean {
  return getFavorites().includes(to);
}