import { useMemo } from "react";
import type { BalanceDoc, PlayerDoc } from "../types/poker";
import { fmtDiff } from "../utils/poker";

type Props = {
  balances: BalanceDoc[];
  players: Record<string, PlayerDoc>;
  topN?: number; // If provided, slice the result
};

export default function RankingTable({ balances, players, topN }: Props) {
  const ranking = useMemo(() => {
    type RankRow = { uid: string; name: string; total: number };
    const sums: Record<string, number> = {};
    balances.forEach((b) => {
      sums[b.player_uid] =
        (sums[b.player_uid] ?? 0) + (b.ending_bb - b.buy_in_bb);
    });
    const rows: RankRow[] = Object.entries(sums)
      .map(([uid, total]) => ({
        uid,
        name: players[uid]?.display_name ?? "(unknown)",
        total,
      }))
      .sort((a, b) => b.total - a.total);
    return rows;
  }, [balances, players]);

  const displayRows = topN ? ranking.slice(0, topN) : ranking;

  // Shared styles
  const th: React.CSSProperties = {
    padding: "8px 12px",
    background: "#f4f4f5",
    fontSize: 12,
    color: "#555",
    fontWeight: 600,
    textAlign: "left",
  };
  const td: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid #eee",
    fontSize: 14,
  };

  if (displayRows.length === 0) {
    return <div style={{ opacity: 0.7 }}>データがありません。</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>順位</th>
          <th style={th}>表示名</th>
          <th style={{ ...th, textAlign: "right" }}>累計BB</th>
        </tr>
      </thead>
      <tbody>
        {displayRows.map((r, idx) => (
          <tr key={r.uid}>
            <td style={td}>{idx + 1}</td>
            <td style={td}>{r.name}</td>
            <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
              {(() => {
                const { text, color } = fmtDiff(r.total);
                return <span style={{ color }}>{text}</span>;
              })()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
