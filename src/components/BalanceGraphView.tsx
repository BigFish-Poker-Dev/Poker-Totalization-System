import { useMemo, useState } from "react";
import type { BalanceRow } from "../types/poker";
import { deltaOf, fmtDiff } from "../utils/poker";
import Modal from "./Modal";

type Props = {
  balances: BalanceRow[];
};

type GraphPoint = {
  date: string;
  cumulative: number;
  x: number;
  y: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const GRAPH_WIDTH = 660;
const GRAPH_HEIGHT = 260;

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

function niceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 10;

  const exponent = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exponent);
  const normalized = rawStep / base;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * base;
}

function buildNiceAxis(minValue: number, maxValue: number) {
  const rawRange = Math.max(1, maxValue - minValue);
  const step = niceStep(rawRange / 4);
  const minY = Math.floor(minValue / step) * step;
  const maxY = Math.ceil(maxValue / step) * step;
  const yTicks: number[] = [];

  for (let tick = maxY; tick >= minY; tick -= step) {
    const rounded = Math.round(tick * 100) / 100;
    yTicks.push(Object.is(rounded, -0) ? 0 : rounded);
  }

  if (!yTicks.includes(0)) {
    yTicks.push(0);
    yTicks.sort((a, b) => b - a);
  }

  return { minY, maxY, yTicks };
}

export default function BalanceGraphView({ balances }: Props) {
  const [hovered, setHovered] = useState<GraphPoint | null>(null);
  const [openFilter, setOpenFilter] = useState(false);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const graph = useMemo(() => {
    const dailyDelta = new Map<string, number>();

    balances.forEach((balance) => {
      if (!balance.date) return;
      if (dateStart && balance.date < dateStart) return;
      if (dateEnd && balance.date > dateEnd) return;
      dailyDelta.set(
        balance.date,
        (dailyDelta.get(balance.date) ?? 0) + deltaOf(balance),
      );
    });

    const filteredReportDates = [...dailyDelta.keys()].sort();
    const allReportDates = balances
      .map((balance) => balance.date)
      .filter(Boolean)
      .sort();

    const startBaseDate = dateStart || filteredReportDates[0] || "";
    const endBaseDate =
      dateEnd ||
      filteredReportDates[filteredReportDates.length - 1] ||
      allReportDates[allReportDates.length - 1] ||
      "";

    if (!startBaseDate || !endBaseDate) {
      return {
        points: [] as GraphPoint[],
        yTicks: [] as number[],
        xTicks: [] as { date: string; x: number }[],
        minY: 0,
        maxY: 0,
      };
    }

    const firstVisibleDate = parseDateOnly(startBaseDate);
    const end = parseDateOnly(endBaseDate);
    if (
      !firstVisibleDate ||
      !end ||
      firstVisibleDate.getTime() > end.getTime()
    ) {
      return {
        points: [] as GraphPoint[],
        yTicks: [] as number[],
        xTicks: [] as { date: string; x: number }[],
        minY: 0,
        maxY: 0,
      };
    }

    const start = new Date(firstVisibleDate.getTime() - DAY_MS);
    const rawPoints: Omit<GraphPoint, "x" | "y">[] = [];
    let cumulative = 0;
    for (
      let current = new Date(start);
      current.getTime() <= end.getTime();
      current = new Date(current.getTime() + DAY_MS)
    ) {
      const date = formatDateOnly(current);
      cumulative += dailyDelta.get(date) ?? 0;
      rawPoints.push({ date, cumulative });
    }

    const values = rawPoints.map((p) => p.cumulative);
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(0, ...values);
    const { minY, maxY, yTicks } = buildNiceAxis(minValue, maxValue);
    const yRange = maxY - minY || 1;

    const points = rawPoints.map((point, index) => ({
      ...point,
      x: rawPoints.length === 1 ? 50 : (index / (rawPoints.length - 1)) * 100,
      y: ((maxY - point.cumulative) / yRange) * 100,
    }));

    const xTickCount = Math.min(6, points.length);
    const xTickIndexes = new Set<number>();
    if (xTickCount > 0) {
      for (let i = 0; i < xTickCount; i++) {
        xTickIndexes.add(
          Math.round(((points.length - 1) / Math.max(1, xTickCount - 1)) * i),
        );
      }
    }
    const xTicks = [...xTickIndexes].map((index) => ({
      date: points[index].date,
      x: points[index].x,
    }));

    return { points, yTicks, xTicks, minY, maxY };
  }, [balances, dateStart, dateEnd]);

  const pathData = graph.points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const latest = graph.points[graph.points.length - 1];
  const displayedPoint = hovered ?? latest ?? null;
  const zeroY =
    ((graph.maxY - 0) / (graph.maxY - graph.minY || 1)) * GRAPH_HEIGHT;
  const hasFilter = Boolean(dateStart || dateEnd);

  const inputStyle: React.CSSProperties = {
    padding: 8,
    borderRadius: 6,
    border: "1px solid #ccc",
    width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    display: "block",
  };

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
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>グラフビュー</h3>
        </div>
        {displayedPoint && (
          <div style={{ fontSize: 14, textAlign: "right" }}>
            <span style={{ color: "#666", marginRight: 8 }}>
              {displayedPoint.date}
            </span>
            {(() => {
              const { text, color } = fmtDiff(displayedPoint.cumulative);
              return <strong style={{ color }}>{text}</strong>;
            })()}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => setOpenFilter(true)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          絞り込み
        </button>
        {hasFilter && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              background: "#f4f4f7",
              border: "1px solid #e6e6ea",
            }}
          >
            日付: {dateStart || "…"}〜{dateEnd || "…"}
            <button
              onClick={() => {
                setDateStart("");
                setDateEnd("");
              }}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        )}
      </div>

      {graph.points.length === 0 ? (
        <div
          style={{
            minHeight: 240,
            display: "grid",
            placeItems: "center",
            color: "#777",
            background: "#fafafa",
            borderRadius: 8,
          }}
        >
          収支データがありません
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <div style={{ minWidth: 620 }}>
            <svg
              viewBox="0 0 760 360"
              role="img"
              aria-label="日付ごとの累計収支グラフ"
              style={{ width: "100%", height: "auto", display: "block" }}
              onMouseLeave={() => setHovered(null)}
            >
              <g transform="translate(64 24)">
                <rect
                  x={0}
                  y={0}
                  width={GRAPH_WIDTH}
                  height={GRAPH_HEIGHT}
                  fill="#fff"
                />

                {graph.yTicks.map((tick) => {
                  const y =
                    ((graph.maxY - tick) / (graph.maxY - graph.minY || 1)) *
                    GRAPH_HEIGHT;
                  return (
                    <g key={tick}>
                      <line
                        x1={0}
                        x2={GRAPH_WIDTH}
                        y1={y}
                        y2={y}
                        stroke={tick === 0 ? "#6b7280" : "#edf0f2"}
                        strokeWidth={tick === 0 ? 1.5 : 1}
                      />
                      <text
                        x={-12}
                        y={y + 4}
                        textAnchor="end"
                        fontSize={12}
                        fill="#6b7280"
                      >
                        {tick}
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
                      y={292}
                      textAnchor="middle"
                      fontSize={12}
                      fill="#6b7280"
                    >
                      {formatShortDate(tick.date)}
                    </text>
                  </g>
                ))}

                {!graph.yTicks.includes(0) && (
                  <line
                    x1={0}
                    x2={GRAPH_WIDTH}
                    y1={zeroY}
                    y2={zeroY}
                    stroke="#6b7280"
                    strokeWidth={1.5}
                  />
                )}
                <line
                  x1={0}
                  x2={GRAPH_WIDTH}
                  y1={GRAPH_HEIGHT}
                  y2={GRAPH_HEIGHT}
                  stroke="#d7dce0"
                />
                <line x1={0} x2={0} y1={0} y2={GRAPH_HEIGHT} stroke="#d7dce0" />

                <path
                  d={pathData}
                  transform={`scale(${GRAPH_WIDTH / 100} ${
                    GRAPH_HEIGHT / 100
                  })`}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={0.55}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />

                {graph.points.map((point) => {
                  const x = (point.x / 100) * GRAPH_WIDTH;
                  const y = (point.y / 100) * GRAPH_HEIGHT;
                  const active = hovered?.date === point.date;
                  return (
                    <g key={point.date}>
                      <line
                        x1={x}
                        x2={x}
                        y1={0}
                        y2={GRAPH_HEIGHT}
                        stroke="transparent"
                        strokeWidth={Math.max(
                          8,
                          GRAPH_WIDTH / graph.points.length,
                        )}
                        style={{ cursor: "crosshair" }}
                        onMouseEnter={() => setHovered(point)}
                        onMouseMove={() => setHovered(point)}
                      />
                      {(active || graph.points.length <= 45) && (
                        <circle
                          cx={x}
                          cy={y}
                          r={active ? 5 : 3}
                          fill={active ? "#1d4ed8" : "#fff"}
                          stroke="#2563eb"
                          strokeWidth={2}
                          pointerEvents="none"
                        />
                      )}
                    </g>
                  );
                })}

                {hovered && (
                  <g pointerEvents="none">
                    <line
                      x1={(hovered.x / 100) * GRAPH_WIDTH}
                      x2={(hovered.x / 100) * GRAPH_WIDTH}
                      y1={0}
                      y2={GRAPH_HEIGHT}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                    />
                    <g
                      transform={`translate(${Math.min(
                        520,
                        Math.max(8, (hovered.x / 100) * GRAPH_WIDTH - 72),
                      )} ${Math.max(
                        8,
                        (hovered.y / 100) * GRAPH_HEIGHT - 54,
                      )})`}
                    >
                      <rect
                        width={140}
                        height={46}
                        rx={8}
                        fill="#111827"
                        opacity={0.94}
                      />
                      <text x={12} y={18} fontSize={12} fill="#e5e7eb">
                        {hovered.date}
                      </text>
                      <text
                        x={12}
                        y={36}
                        fontSize={14}
                        fontWeight={700}
                        fill="#fff"
                      >
                        {fmtDiff(hovered.cumulative).text}
                      </text>
                    </g>
                  </g>
                )}
              </g>
            </svg>
          </div>
        </div>
      )}

      <Modal open={openFilter} onClose={() => setOpenFilter(false)} width={520}>
        <h3 style={{ marginTop: 0 }}>絞り込み</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <label style={labelStyle}>日付（開始）</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>日付（終了）</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
            onClick={() => {
              setDateStart("");
              setDateEnd("");
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            クリア
          </button>
          <button
            onClick={() => setOpenFilter(false)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            適用
          </button>
        </div>
      </Modal>
    </div>
  );
}
