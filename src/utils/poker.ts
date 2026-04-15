import type { GroupDoc, HistoryDoc, PlayerDoc } from "../types/poker";

export type ReportUnit = "bb" | "points";

export const pad6 = (n: number | string) =>
  String(n).replace(/\D/g, "").padStart(6, "0");

export const formatTs = (t?: any) => t?.toDate?.().toLocaleString?.() || "-";

export const parseLegacyStakes = (s?: string | null) => {
  if (!s) return { sb: null as number | null, bb: null as number | null };
  const [a, b] = s.split("/").map((x) => Number(x));
  return { sb: isNaN(a) ? null : a, bb: isNaN(b) ? null : b };
};

export const getReportUnit = (group?: GroupDoc | null): ReportUnit =>
  group?.settings?.report_unit === "points" ? "points" : "bb";

export const unitLabel = (unit: ReportUnit) => (unit === "points" ? "点" : "BB");

export const fmtDiff = (v: number, unit: ReportUnit = "bb") => {
  const sign = v >= 0 ? "+" : "-";
  const num = Math.abs(v).toFixed(1);
  const color = v >= 0 ? "#111" : "#d00";
  return { text: `${sign}${num}${unitLabel(unit)}`, color };
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
export const buyInOf = (b: { buy_in?: number; buy_in_bb?: number }) =>
  Number(b.buy_in ?? b.buy_in_bb ?? 0) || 0;
export const endingOf = (b: { ending?: number; ending_bb?: number }) =>
  Number(b.ending ?? b.ending_bb ?? 0) || 0;
export const deltaOf = (b: {
  ending?: number;
  buy_in?: number;
  ending_bb?: number;
  buy_in_bb?: number;
}) => endingOf(b) - buyInOf(b);

export const playerNameOf = (uid?: string, players?: Record<string, PlayerDoc>) => {
  if (!uid) return "";
  return players?.[uid]?.display_name ?? "";
};

export const randDigits = (k: number) =>
  Array.from({ length: k }, () => Math.floor(Math.random() * 10)).join("");

export function getFixedStakes(
  group: GroupDoc | null
): { sb: number; bb: number } | null {
  if (getReportUnit(group) !== "bb") return null;
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
