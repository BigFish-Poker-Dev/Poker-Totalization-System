import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { PlayerDoc } from "../types/poker";

const FALLBACK_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#CA8A04",
  "#9333EA",
  "#0891B2",
  "#EA580C",
  "#BE123C",
  "#4F46E5",
  "#0F766E",
  "#A16207",
  "#7C3AED",
];

export function normalizeColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return "";
}

export function fallbackColorForUid(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function generateUniqueRankingColor(usedColors: Set<string>) {
  for (const color of FALLBACK_COLORS) {
    if (!usedColors.has(color)) return color;
  }

  for (let i = 0; i < 1000; i++) {
    const color = normalizeColor(
      `#${Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, "0")}`,
    );
    if (!usedColors.has(color)) return color;
  }

  return "#111827";
}

export function playerRankingColor(uid: string, player?: PlayerDoc) {
  return normalizeColor(player?.ranking_color ?? "") || fallbackColorForUid(uid);
}

export async function ensureMissingRankingColors(
  groupId: string,
  players: Record<string, PlayerDoc>,
) {
  const usedColors = new Set(
    Object.values(players)
      .map((player) => normalizeColor(player.ranking_color ?? ""))
      .filter(Boolean),
  );
  const patchedPlayers = { ...players };

  await Promise.all(
    Object.entries(players).map(async ([uid, player]) => {
      if (normalizeColor(player.ranking_color ?? "")) return;

      const color = generateUniqueRankingColor(usedColors);
      usedColors.add(color);
      patchedPlayers[uid] = { ...player, ranking_color: color };

      try {
        await updateDoc(doc(db, "groups", groupId, "players", uid), {
          ranking_color: color,
        });
      } catch (error) {
        console.warn("Failed to assign ranking color", { groupId, uid, error });
      }
    }),
  );

  return patchedPlayers;
}
