import type { GroupDoc, HistoryDoc, PlayerDoc } from "../types/poker";

export const pad6 = (n: number | string) =>
  String(n).replace(/\D/g, "").padStart(6, "0");

export const formatTs = (t?: any) => t?.toDate?.().toLocaleString?.() || "-";

export const parseLegacyStakes = (s?: string | null) => {
  if (!s) return { sb: null as number | null, bb: null as number | null };
  const [a, b] = s.split("/").map((x) => Number(x));
  return { sb: isNaN(a) ? null : a, bb: isNaN(b) ? null : b };
};

export const fmtDiff = (v: number) => {
  const sign = v >= 0 ? "+" : "-";
  const num = Math.abs(v).toFixed(1);
  const color = v >= 0 ? "#111" : "#d00";
  return { text: `${sign}${num}BB`, color };
};

export const CAT_COLOR: Record<HistoryDoc["change_category"], string> = {
  create: "#111111",
  update: "#1a73e8",
  delete: "#d93025",
};

export const creatorNameOf = (g?: GroupDoc) =>
  g?.creator_name ||
  (g?.creator && g.creator.includes("@")
    ? g.creator.split("@")[0]
    : g?.creator) ||
  "(unknown)";

// Helper functions for filtering/sorting
export const toMs = (v: string) => (v ? new Date(v).getTime() : null);
export const toMsDateOnly = (v: string) =>
  v ? new Date(v).setHours(0, 0, 0, 0) : null;
export const toMsDateOnlyEnd = (v: string) =>
  v ? new Date(v).setHours(23, 59, 59, 999) : null;
export const num = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};
export const deltaOf = (b: { ending_bb: number; buy_in_bb: number }) =>
  (Number(b.ending_bb) || 0) - (Number(b.buy_in_bb) || 0);

export const playerNameOf = (uid?: string, players?: Record<string, PlayerDoc>) => {
  if (!uid) return "";
  return players?.[uid]?.display_name ?? "";
};

export const randDigits = (k: number) =>
  Array.from({ length: k }, () => Math.floor(Math.random() * 10)).join("");

export function getFixedStakes(
  group: GroupDoc | null
): { sb: number; bb: number } | null {
  if (!group?.settings?.stakes_fixed) return null;
  const s = group.settings!;
  if (typeof s.stakes_sb === "number" && typeof s.stakes_bb === "number") {
    return { sb: s.stakes_sb, bb: s.stakes_bb };
  }
  // 旧: "1/3" をパース
  const leg = parseLegacyStakes(s.stakes_value);
  if (leg.sb != null && leg.bb != null) {
    return { sb: leg.sb, bb: leg.bb };
  }
  return null;
}
