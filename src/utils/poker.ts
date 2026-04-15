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

type BalanceUnitSource = {
  report_unit?: ReportUnit;
  stakes?: string;
  buy_in?: number;
  ending?: number;
  buy_in_bb?: number;
  ending_bb?: number;
};

const amountInUnit = (
  value: number,
  fromUnit: ReportUnit,
  toUnit: ReportUnit,
  bbStake: number
) => {
  if (fromUnit === toUnit) return value;
  if (fromUnit === "bb" && toUnit === "points") return value * bbStake;
  return value / bbStake;
};

export const balanceReportUnitOf = (
  b: BalanceUnitSource,
  fallbackUnit: ReportUnit = "bb"
): ReportUnit => {
  if (b.report_unit === "points" || b.report_unit === "bb") return b.report_unit;
  if (
    b.buy_in_bb != null ||
    b.ending_bb != null ||
    (b.stakes && b.stakes.trim() !== "")
  ) {
    return "bb";
  }
  return fallbackUnit;
};

export const stakeBbOf = (
  b: Pick<BalanceUnitSource, "stakes">,
  group?: GroupDoc | null
) => {
  const balanceStake = parseLegacyStakes(b.stakes);
  if (balanceStake.bb != null && balanceStake.bb > 0) return balanceStake.bb;
  const settings = group?.settings;
  if (typeof settings?.stakes_bb === "number" && settings.stakes_bb > 0) {
    return settings.stakes_bb;
  }
  const groupStake = parseLegacyStakes(settings?.stakes_value);
  if (groupStake.bb != null && groupStake.bb > 0) return groupStake.bb;
  return 1;
};

export const buyInInUnit = (
  b: BalanceUnitSource,
  displayUnit: ReportUnit = "bb",
  group?: GroupDoc | null
) =>
  amountInUnit(
    buyInOf(b),
    balanceReportUnitOf(b, displayUnit),
    displayUnit,
    stakeBbOf(b, group)
  );

export const endingInUnit = (
  b: BalanceUnitSource,
  displayUnit: ReportUnit = "bb",
  group?: GroupDoc | null
) =>
  amountInUnit(
    endingOf(b),
    balanceReportUnitOf(b, displayUnit),
    displayUnit,
    stakeBbOf(b, group)
  );

export const deltaInUnit = (
  b: BalanceUnitSource,
  displayUnit: ReportUnit = "bb",
  group?: GroupDoc | null
) => endingInUnit(b, displayUnit, group) - buyInInUnit(b, displayUnit, group);

export const fmtAmount = (v: number) =>
  Number.isInteger(v) ? String(v) : v.toFixed(1);

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
