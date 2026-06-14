const KEY = "tvet:recent-pages";
const MAX = 5;

export type RecentPage = { to: string; label: string; at: number };

export function getRecentPages(): RecentPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentPage[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentPage(page: { to: string; label: string }) {
  if (typeof window === "undefined") return;
  const list = getRecentPages().filter((p) => p.to !== page.to);
  list.unshift({ ...page, at: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event("tvet:recent-pages"));
  } catch {
    /* ignore */
  }
}