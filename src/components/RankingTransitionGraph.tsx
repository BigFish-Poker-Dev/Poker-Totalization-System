import { useMemo, useState } from "react";
import type { BalanceDoc, PlayerDoc } from "../types/poker";
import { deltaInUnit, unitLabel, type ReportUnit } from "../utils/poker";
import { playerRankingColor } from "../utils/playerColors";

type Props = {
  balances: BalanceDoc[];
  players: Record<string, PlayerDoc>;
  rankLimit?: number;
  title?: string;
  reportUnit?: ReportUnit;
};

type RankPoint = {
  uid: string;
  date: string;
  rank: number;
  total: number;
  x: number;
  y: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const GRAPH_WIDTH = 700;
const GRAPH_HEIGHT = 300;

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function playerName(uid: string, players: Record<string, PlayerDoc>) {
  return players[uid]?.display_name || uid;
}

export default function RankingTransitionGraph({
  balances,
  players,
  rankLimit,
  title = "ランキング推移",
  reportUnit = "bb",
}: Props) {
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const graph = useMemo(() => {
    const playerIds = Object.keys(players).sort((a, b) =>
      playerName(a, players).localeCompare(playerName(b, players)),
    );
    const activeBalances = balances.filter((balance) => balance.date);
    const balanceDates = activeBalances.map((balance) => balance.date).sort();

    if (playerIds.length === 0 || balanceDates.length === 0) {
      return {
        dates: [] as string[],
        rankCount: 0,
        visibleUids: [] as string[],
        pointsByUid: new Map<string, RankPoint[]>(),
        segmentsByUid: new Map<string, RankPoint[][]>(),
        ranksByDate: new Map<string, RankPoint[]>(),
        xTicks: [] as { date: string; x: number }[],
      };
    }

    const firstDate = parseDateOnly(balanceDates[0]);
    const lastDate = parseDateOnly(balanceDates[balanceDates.length - 1]);
    if (!firstDate || !lastDate) {
      return {
        dates: [] as string[],
        rankCount: 0,
        visibleUids: [] as string[],
        pointsByUid: new Map<string, RankPoint[]>(),
        segmentsByUid: new Map<string, RankPoint[][]>(),
        ranksByDate: new Map<string, RankPoint[]>(),
        xTicks: [] as { date: string; x: number }[],
      };
    }

    const dailyDeltaByDate = new Map<string, Map<string, number>>();
    activeBalances.forEach((balance) => {
      const byPlayer = dailyDeltaByDate.get(balance.date) ?? new Map();
      byPlayer.set(
        balance.player_uid,
        (byPlayer.get(balance.player_uid) ?? 0) + deltaInUnit(balance, reportUnit),
      );
      dailyDeltaByDate.set(balance.date, byPlayer);
    });

    const startDate = new Date(firstDate.getTime() - DAY_MS);
    const dates: string[] = [];
    for (
      let current = new Date(startDate);
      current.getTime() <= lastDate.getTime();
      current = new Date(current.getTime() + DAY_MS)
    ) {
      dates.push(formatDateOnly(current));
    }

    const totals = new Map(playerIds.map((uid) => [uid, 0]));
    const pointsByUid = new Map<string, RankPoint[]>(
      playerIds.map((uid) => [uid, []]),
    );
    const ranksByDate = new Map<string, RankPoint[]>();
    const rankCount = Math.max(
      1,
      Math.min(rankLimit ?? playerIds.length, playerIds.length),
    );

    dates.forEach((date, dateIndex) => {
      const deltas = dailyDeltaByDate.get(date);
      deltas?.forEach((delta, uid) => {
        totals.set(uid, (totals.get(uid) ?? 0) + delta);
      });

      const ranked = [...playerIds].sort((a, b) => {
        const totalDiff = (totals.get(b) ?? 0) - (totals.get(a) ?? 0);
        if (totalDiff !== 0) return totalDiff;
        return playerName(a, players).localeCompare(playerName(b, players));
      });

      const pointsForDate = ranked.map((uid, index) => {
        const rank = index + 1;
        const point: RankPoint = {
          uid,
          date,
          rank,
          total: totals.get(uid) ?? 0,
          x: dates.length === 1 ? 50 : (dateIndex / (dates.length - 1)) * 100,
          y:
            rankCount === 1
              ? 50
              : ((rank - 1) / Math.max(1, rankCount - 1)) * 100,
        };
        pointsByUid.get(uid)?.push(point);
        return point;
      });
      ranksByDate.set(date, pointsForDate);
    });

    const visibleUidSet = new Set<string>();
    pointsByUid.forEach((points, uid) => {
      if (points.some((point) => point.rank <= rankCount)) {
        visibleUidSet.add(uid);
      }
    });

    const visibleUids = [...visibleUidSet].sort((a, b) => {
      const bestA = Math.min(
        ...(pointsByUid.get(a) ?? []).map((point) => point.rank),
      );
      const bestB = Math.min(
        ...(pointsByUid.get(b) ?? []).map((point) => point.rank),
      );
      return bestA - bestB || playerName(a, players).localeCompare(playerName(b, players));
    });

    const segmentsByUid = new Map<string, RankPoint[][]>();
    visibleUids.forEach((uid) => {
      const segments: RankPoint[][] = [];
      let currentSegment: RankPoint[] = [];
      (pointsByUid.get(uid) ?? []).forEach((point) => {
        if (point.rank <= rankCount) {
          currentSegment.push(point);
        } else if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      });
      if (currentSegment.length > 0) segments.push(currentSegment);
      segmentsByUid.set(uid, segments);
    });

    const xTickCount = Math.min(6, dates.length);
    const xTickIndexes = new Set<number>();
    for (let i = 0; i < xTickCount; i++) {
      xTickIndexes.add(
        Math.round(((dates.length - 1) / Math.max(1, xTickCount - 1)) * i),
      );
    }
    const xTicks = [...xTickIndexes].map((index) => ({
      date: dates[index],
      x: dates.length === 1 ? 50 : (index / (dates.length - 1)) * 100,
    }));

    return {
      dates,
      rankCount,
      visibleUids,
      pointsByUid,
      segmentsByUid,
      ranksByDate,
      xTicks,
    };
  }, [balances, players, rankLimit, reportUnit]);

  const hoveredRanks = hoverDate
    ? (graph.ranksByDate.get(hoverDate) ?? []).filter(
        (point) => point.rank <= graph.rankCount,
      )
    : [];

  if (graph.dates.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div style={{ opacity: 0.7 }}>グラフ用の収支データがありません。</div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div style={{ marginTop: 4, fontSize: 12, color: "#777" }}>
            日付ごとの累計{unitLabel(reportUnit)}順位
          </div>
        </div>
        {hoverDate && (
          <div style={{ fontSize: 12, color: "#555", textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>{hoverDate}</div>
            {hoveredRanks.slice(0, 6).map((point) => (
              <div key={point.uid}>
                {point.rank}位 {playerName(point.uid, players)} (
                {point.total.toFixed(1)}
                {unitLabel(reportUnit)})
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {graph.visibleUids.map((uid) => (
          <span
            key={uid}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: playerRankingColor(uid, players[uid]),
              }}
            />
            {playerName(uid, players)}
          </span>
        ))}
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ minWidth: 720 }}>
          <svg
            viewBox="0 0 820 400"
            role="img"
            aria-label="ランキング推移グラフ"
            style={{ width: "100%", height: "auto", display: "block" }}
            onMouseLeave={() => setHoverDate(null)}
          >
            <g transform="translate(64 24)">
              <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="#fff" />

              {Array.from({ length: graph.rankCount }, (_, index) => {
                const rank = index + 1;
                const y =
                  graph.rankCount === 1
                    ? GRAPH_HEIGHT / 2
                    : (index / Math.max(1, graph.rankCount - 1)) *
                      GRAPH_HEIGHT;
                return (
                  <g key={rank}>
                    <line
                      x1={0}
                      x2={GRAPH_WIDTH}
                      y1={y}
                      y2={y}
                      stroke="#edf0f2"
                    />
                    <text
                      x={-12}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={12}
                      fill="#6b7280"
                    >
                      {rank}
                    </text>
                  </g>
                );
              })}

              {graph.xTicks.map((tick) => (
                <g key={tick.date}>
                  <line
                    x1={(tick.x / 100) * GRAPH_WIDTH}
                    x2={(tick.x / 100) * GRAPH_WIDTH}
                    y1={0}
                    y2={GRAPH_HEIGHT}
                    stroke="#f5f6f7"
                  />
                  <text
                    x={(tick.x / 100) * GRAPH_WIDTH}
                    y={GRAPH_HEIGHT + 32}
                    textAnchor="middle"
                    fontSize={12}
                    fill="#6b7280"
                  >
                    {formatShortDate(tick.date)}
                  </text>
                </g>
              ))}

              <line
                x1={0}
                x2={GRAPH_WIDTH}
                y1={GRAPH_HEIGHT}
                y2={GRAPH_HEIGHT}
                stroke="#d7dce0"
              />
              <line x1={0} x2={0} y1={0} y2={GRAPH_HEIGHT} stroke="#d7dce0" />

              {graph.visibleUids.map((uid) =>
                (graph.segmentsByUid.get(uid) ?? []).map((segment, index) => {
                  const path = segment
                    .map(
                      (point, pointIndex) =>
                        `${pointIndex === 0 ? "M" : "L"} ${
                          (point.x / 100) * GRAPH_WIDTH
                        } ${(point.y / 100) * GRAPH_HEIGHT}`,
                    )
                    .join(" ");
                  return (
                    <path
                      key={`${uid}-${index}`}
                      d={path}
                      fill="none"
                      stroke={playerRankingColor(uid, players[uid])}
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  );
                }),
              )}

              {graph.dates.map((date, index) => {
                const x =
                  graph.dates.length === 1
                    ? GRAPH_WIDTH / 2
                    : (index / (graph.dates.length - 1)) * GRAPH_WIDTH;
                return (
                  <line
                    key={date}
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={GRAPH_HEIGHT}
                    stroke="transparent"
                    strokeWidth={Math.max(8, GRAPH_WIDTH / graph.dates.length)}
                    style={{ cursor: "crosshair" }}
                    onMouseEnter={() => setHoverDate(date)}
                    onMouseMove={() => setHoverDate(date)}
                  />
                );
              })}

              {hoverDate && (
                <line
                  x1={
                    ((graph.dates.indexOf(hoverDate) /
                      Math.max(1, graph.dates.length - 1)) *
                      GRAPH_WIDTH) ||
                    0
                  }
                  x2={
                    ((graph.dates.indexOf(hoverDate) /
                      Math.max(1, graph.dates.length - 1)) *
                      GRAPH_WIDTH) ||
                    0
                  }
                  y1={0}
                  y2={GRAPH_HEIGHT}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
