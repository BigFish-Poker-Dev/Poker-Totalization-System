import {
  CAT_COLOR,
  formatTs,
  playerNameOf,
  fmtDiff,
} from "../utils/poker";
import Modal from "./Modal";
import type { HistoryDoc, PlayerDoc } from "../types/poker";
import {
  useHistoryFilter,
  type HSortKey,
} from "../hooks/useHistoryFilter";
import { useState, useMemo } from "react";

type Props = {
  histories: HistoryDoc[];
  players: Record<string, PlayerDoc>;
};

export default function HistoryList({ histories, players }: Props) {
  const {
    filter,
    setFilter,
    sortKey,
    sortDir,
    toggleSort,
    historiesFiltered, // sorted FlatHistoryRow[]
    clearFilter,
  } = useHistoryFilter(histories, players);

  const [openFilter, setOpenFilter] = useState(false);

  // Styles
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
  const inp: React.CSSProperties = {
    padding: 8,
    borderRadius: 6,
    border: "1px solid #ccc",
    width: "100%",
    boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    display: "block",
  };

  const SortBtn = ({
    k,
    label,
    alignRight,
  }: {
    k: HSortKey;
    label: string;
    alignRight?: boolean;
  }) => (
    <button
      onClick={() => toggleSort(k)}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        justifyContent: alignRight ? "flex-end" : "flex-start",
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 12, opacity: 0.7 }}>
        {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : "▲▼"}
      </span>
    </button>
  );

  // Filter Summary Chips
  const filterSummary = useMemo(() => {
    const items: { label: string; clear: () => void }[] = [];
    const f = filter;

    const clearField = (key: keyof typeof f, val: string = "") => {
      setFilter((prev) => ({ ...prev, [key]: val }));
    };

    if (f.changedStart || f.changedEnd) {
      items.push({
        label: `更新日時: ${f.changedStart}〜${f.changedEnd}`,
        clear: () =>
          setFilter((prev) => ({ ...prev, changedStart: "", changedEnd: "" })),
      });
    }
    if (f.category) {
      items.push({
        label: `種別: ${f.category}`,
        clear: () => clearField("category"),
      });
    }
    if (f.player) {
      items.push({
        label: `Player: ${playerNameOf(f.player, players) || f.player}`,
        clear: () => clearField("player"),
      });
    }
    if (f.dateStart || f.dateEnd) {
      items.push({
        label: `日付: ${f.dateStart}〜${f.dateEnd}`,
        clear: () =>
          setFilter((prev) => ({ ...prev, dateStart: "", dateEnd: "" })),
      });
    }
    if (f.stakes) {
      items.push({
        label: `Stakes: ${f.stakes}`,
        clear: () => clearField("stakes"),
      });
    }
    if (f.buyInMin || f.buyInMax) {
      items.push({
        label: `BuyIn: ${f.buyInMin}〜${f.buyInMax}`,
        clear: () =>
          setFilter((prev) => ({ ...prev, buyInMin: "", buyInMax: "" })),
      });
    }
    if (f.endingMin || f.endingMax) {
      items.push({
        label: `Ending: ${f.endingMin}〜${f.endingMax}`,
        clear: () =>
          setFilter((prev) => ({ ...prev, endingMin: "", endingMax: "" })),
      });
    }
    if (f.deltaMin || f.deltaMax) {
      items.push({
        label: `差分: ${f.deltaMin}〜${f.deltaMax}`,
        clear: () =>
          setFilter((prev) => ({ ...prev, deltaMin: "", deltaMax: "" })),
      });
    }
    if (f.memo) {
      items.push({
        label: `Memo: ${f.memo}`,
        clear: () => clearField("memo"),
      });
    }
    if (f.balanceId) {
      items.push({
        label: `ID: ${f.balanceId}`,
        clear: () => clearField("balanceId"),
      });
    }

    return items;
  }, [filter, players, setFilter]);

  return (
    <div style={{ marginTop: 16 }}>
      {/* フィルタ要約エリア */}
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>更新履歴リスト</h3>
      <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
        {historiesFiltered.length} 件
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 8,
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
        {filterSummary.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {filterSummary.map((it, i) => (
              <span
                key={i}
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
                {it.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    it.clear();
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
            ))}
          </div>
        )}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          border: "1px solid #eee",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <thead>
          <tr>
            <th style={th}>
              <SortBtn k="changed_at" label="更新日時" />
            </th>
            <th style={th}>種別</th>
            <th style={th}>行</th>
            <th style={th}>プレイヤー</th>
            <th style={th}>
              <SortBtn k="date" label="日付" />
            </th>
            <th style={th}>ステークス</th>
            <th style={{ ...th, textAlign: "right" }}>
              <SortBtn k="buy_in_bb" label="BuyIn" alignRight />
            </th>
            <th style={{ ...th, textAlign: "right" }}>
              <SortBtn k="ending_bb" label="Ending" alignRight />
            </th>
            <th style={{ ...th, textAlign: "right" }}>
              <SortBtn k="delta" label="差分" alignRight />
            </th>
            <th style={th}>メモ</th>
            <th style={th}>変更者</th>
            <th style={th}>balance_id</th>
          </tr>
        </thead>
        <tbody>
          {historiesFiltered.map((item) => {
            const { h, rows } = item;
            const cName = playerNameOf(h.changer_uid, players) || h.changer_uid;
            const when = formatTs(h.changed_at);

            return rows.map((r, ri) => {
              const isStart = ri === 0;
              const rowSpan = isStart ? rows.length : 0;
              const showMeta = isStart;

              const delta =
                (Number(r.b.ending_bb) || 0) - (Number(r.b.buy_in_bb) || 0);
              const dInfo = fmtDiff(delta);

              return (
                <tr
                  key={`${h.history_id}-${ri}`}
                  style={{
                    background:
                      r.kind === "before"
                        ? "#fff0f0"
                        : r.kind === "after"
                        ? "#f0fff4"
                        : undefined,
                  }}
                >
                  {showMeta && (
                    <>
                      <td style={td} rowSpan={rowSpan}>
                        {when}
                      </td>
                      <td style={td} rowSpan={rowSpan}>
                        <span
                          style={{
                            color: CAT_COLOR[h.change_category],
                            fontWeight: 600,
                          }}
                        >
                          {h.change_category}
                        </span>
                      </td>
                    </>
                  )}
                  <td style={td}>
                    {r.kind === "single"
                      ? "-"
                      : r.kind === "before"
                      ? "before"
                      : "after"}
                  </td>
                  <td style={td}>
                    {playerNameOf(
                      r.b.player_uid ||
                        (h.change_details as any)?.before?.player_uid ||
                        (h.change_details as any)?.after?.player_uid ||
                        "",
                      players
                    )}
                  </td>
                  <td style={td}>{r.b.date}</td>
                  <td style={td}>{r.b.stakes}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.b.buy_in_bb}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.b.ending_bb}</td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      color: dInfo.color,
                      fontWeight: "bold",
                    }}
                  >
                    {dInfo.text}
                  </td>
                  <td style={{ ...td, maxWidth: 120, wordBreak: "break-all" }}>
                    {r.b.memo}
                  </td>
                  {showMeta && (
                    <>
                      <td style={td} rowSpan={rowSpan}>
                        {cName}
                      </td>
                      <td style={td} rowSpan={rowSpan}>
                        {h.balance_id}
                      </td>
                    </>
                  )}
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      {/* フィルタモーダル */}
      <Modal open={openFilter} onClose={() => setOpenFilter(false)} width={720}>
        <h3 style={{ marginTop: 0 }}>更新履歴の絞り込み</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* 更新日時 */}
          <div>
            <label style={lbl}>更新日時（開始）</label>
            <input
              type="datetime-local"
              value={filter.changedStart}
              onChange={(e) =>
                setFilter({ ...filter, changedStart: e.target.value })
              }
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>更新日時（終了）</label>
            <input
              type="datetime-local"
              value={filter.changedEnd}
              onChange={(e) =>
                setFilter({ ...filter, changedEnd: e.target.value })
              }
              style={inp}
            />
          </div>

          {/* 種別 & プレイヤー */}
          <div>
            <label style={lbl}>種別</label>
            <select
              value={filter.category}
              onChange={(e) =>
                setFilter({ ...filter, category: e.target.value })
              }
              style={inp}
            >
              <option value="">すべて</option>
              <option value="create">create</option>
              <option value="update">update</option>
              <option value="delete">delete</option>
            </select>
          </div>
          <div>
            <label style={lbl}>プレイヤー</label>
            <select
              value={filter.player}
              onChange={(e) => setFilter({ ...filter, player: e.target.value })}
              style={inp}
            >
              <option value="">全員</option>
              {Object.entries(players).map(([uid, p]) => (
                <option key={p.player_id} value={uid}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* 日付 */}
          <div>
            <label style={lbl}>日付（開始）</label>
            <input
              type="date"
              value={filter.dateStart}
              onChange={(e) =>
                setFilter({ ...filter, dateStart: e.target.value })
              }
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>日付（終了）</label>
            <input
              type="date"
              value={filter.dateEnd}
              onChange={(e) =>
                setFilter({ ...filter, dateEnd: e.target.value })
              }
              style={inp}
            />
          </div>

          {/* ステークス */}
          <div>
            <label style={lbl}>ステークス</label>
            <input
              value={filter.stakes}
              onChange={(e) => setFilter({ ...filter, stakes: e.target.value })}
              placeholder="部分一致"
              style={inp}
            />
          </div>
          <div />

          {/* BuyIn */}
          <div>
            <label style={lbl}>BuyIn 最小</label>
            <input
              type="number"
              value={filter.buyInMin}
              onChange={(e) =>
                setFilter({ ...filter, buyInMin: e.target.value })
              }
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>BuyIn 最大</label>
            <input
              type="number"
              value={filter.buyInMax}
              onChange={(e) =>
                setFilter({ ...filter, buyInMax: e.target.value })
              }
              style={inp}
            />
          </div>

          {/* Ending */}
          <div>
            <label style={lbl}>Ending 最小</label>
            <input
              type="number"
              value={filter.endingMin}
              onChange={(e) =>
                setFilter({ ...filter, endingMin: e.target.value })
              }
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>Ending 最大</label>
            <input
              type="number"
              value={filter.endingMax}
              onChange={(e) =>
                setFilter({ ...filter, endingMax: e.target.value })
              }
              style={inp}
            />
          </div>

          {/* 差分 */}
          <div>
            <label style={lbl}>差分 最小</label>
            <input
              type="number"
              value={filter.deltaMin}
              onChange={(e) =>
                setFilter({ ...filter, deltaMin: e.target.value })
              }
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>差分 最大</label>
            <input
              type="number"
              value={filter.deltaMax}
              onChange={(e) =>
                setFilter({ ...filter, deltaMax: e.target.value })
              }
              style={inp}
            />
          </div>

          {/* メモ */}
          <div>
            <label style={lbl}>メモ</label>
            <input
              value={filter.memo}
              onChange={(e) => setFilter({ ...filter, memo: e.target.value })}
              placeholder="部分一致"
              style={inp}
            />
          </div>
          <div />

          {/* balance_id */}
          <div>
            <label style={lbl}>balance_id（完全一致）</label>
            <input
              value={filter.balanceId}
              onChange={(e) =>
                setFilter({ ...filter, balanceId: e.target.value })
              }
              // inputMode="numeric" // ID usually numeric but string type
              style={inp}
            />
          </div>
          <div />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
            onClick={clearFilter}
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
