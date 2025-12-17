import { useMemo, useState } from "react";
import type { BalanceDoc, HistoryDoc, PlayerDoc } from "../types/poker";
import { toMs } from "../utils/poker";

export type HSortKey = "changed_at" | "date" | "buy_in_bb" | "ending_bb" | "delta";
export type HSortDir = "asc" | "desc";

export type HistoryFilterState = {
  changedStart: string;
  changedEnd: string;
  category: string;
  player: string; // uid
  dateStart: string;
  dateEnd: string;
  stakes: string;
  buyInMin: string;
  buyInMax: string;
  endingMin: string;
  endingMax: string;
  deltaMin: string;
  deltaMax: string;
  memo: string;
  balanceId: string;
};

export const INITIAL_HISTORY_FILTER: HistoryFilterState = {
  changedStart: "",
  changedEnd: "",
  category: "",
  player: "",
  dateStart: "",
  dateEnd: "",
  stakes: "",
  buyInMin: "",
  buyInMax: "",
  endingMin: "",
  endingMax: "",
  deltaMin: "",
  deltaMax: "",
  memo: "",
  balanceId: "",
};

// ヘルパー: 履歴を展開して表示用にする
type HRow = {
  kind: "single" | "before" | "after";
  b: Partial<BalanceDoc> & { player_uid?: string };
};

export function expandHistory(h: HistoryDoc): HRow[] {
  const det = h.change_details || {};
  if (h.change_category === "create" && det.after) {
    return [{ kind: "single", b: det.after }];
  }
  if (h.change_category === "delete" && det.before) {
    return [{ kind: "single", b: det.before }];
  }
  if (h.change_category === "update") {
    const rows: HRow[] = [];
    if (det.after) rows.push({ kind: "after", b: det.after });
    if (det.before) rows.push({ kind: "before", b: det.before });
    return rows;
  }
  return [];
}

export function useHistoryFilter(
  histories: HistoryDoc[],
  _players: Record<string, PlayerDoc>
) {
  const [filter, setFilter] = useState<HistoryFilterState>(INITIAL_HISTORY_FILTER);
  const [sortKey, setSortKey] = useState<HSortKey>("changed_at");
  const [sortDir, setSortDir] = useState<HSortDir>("desc");

  // フィルタリング
  const historiesFiltered = useMemo(() => {
    return histories.filter((h) => {
      // 1. 更新日時
      if (filter.changedStart) {
        const t = toMs(filter.changedStart); // YYYY-MM-DD -> 00:00
        if (t && (h.changed_at?.toMillis?.() ?? 0) < t) return false;
      }
      if (filter.changedEnd) {
        const t = toMs(filter.changedEnd);
        // End日は 23:59:59 相当にするか、翌日00:00未満にするのが自然だが
        // 既存実装に合わせて単純比較なら >= t に注意。
        // ここでは toMs が 00:00 を返すとして、
        // もし "その日の終わりまで" を含めたいなら +24h するなどの調整が必要。
        // AdminGroupPageの実装では `updated_at` (Timestamp) と `toMs` (Date string) の比較だった。
        // toMsDateOnlyEnd とか使う手もあるが、既存仕様を踏襲する。
        if (t) {
          // 既存: toMs(fHChangedEnd) + 86400000 して < で比較してたかもしれない？
          // ここでは一旦、既存コードのロジックを読み解く。
          // 実装元のコードでは:
          // const start = toMs(fHChangedStart); if (start && ... < start) return false;
          // const end = toMs(fHChangedEnd); if (end && ... > end + 86400000) return false;
          const endTs = t + 86400000;
          if ((h.changed_at?.toMillis?.() ?? 0) >= endTs) return false;
        }
      }

      // 2. ID
      if (filter.balanceId && String(h.balance_id) !== filter.balanceId) {
        return false;
      }

      // 3. 変更種別
      if (filter.category && h.change_category !== filter.category) {
        return false;
      }

      // 4. 変更者(player uid) - 今回は "changer_uid" ではなく "Balanceの持ち主" でフィルタすることが多い
      // AdminGroupPageの実装では: fHPlayerがあったら
      //   const uid = h.change_details?.before?.player_uid || after?.player_uid
      //   それが一致するか？
      //   あるいは changer_uid もチェック？ -> いえ、BalanceDocのuidを見てたはず。
      //   再確認すると: rowMatches 関数で `b.player_uid === fHPlayer` をチェックしている。
      
      const det: any = h.change_details || {};
      
      const rowMatches = (b?: Partial<BalanceDoc>) => {
        if (!b) return false;
        // Player
        if (filter.player && b.player_uid !== filter.player) return false;
        // Date
        if (filter.dateStart && (b.date || "") < filter.dateStart) return false;
        if (filter.dateEnd && (b.date || "") > filter.dateEnd) return false;
        // Stakes
        if (filter.stakes && (b.stakes || "").indexOf(filter.stakes) === -1)
          return false;
        // BuyIn
        if (filter.buyInMin && (Number(b.buy_in_bb) || 0) < Number(filter.buyInMin))
          return false;
        if (filter.buyInMax && (Number(b.buy_in_bb) || 0) > Number(filter.buyInMax))
          return false;
        // Ending
        if (filter.endingMin && (Number(b.ending_bb) || 0) < Number(filter.endingMin))
          return false;
        if (filter.endingMax && (Number(b.ending_bb) || 0) > Number(filter.endingMax))
          return false;
        
        const delta = (Number(b.ending_bb) || 0) - (Number(b.buy_in_bb) || 0);
        if (filter.deltaMin && delta < Number(filter.deltaMin)) return false;
        if (filter.deltaMax && delta > Number(filter.deltaMax)) return false;

        // Memo
        if (filter.memo && (b.memo || "").indexOf(filter.memo) === -1)
          return false;

        return true;
      };

      // フィルタ項目がどれか1つでも入力されていれば詳細チェック
      const hasDetailFilter =
        filter.player ||
        filter.dateStart ||
        filter.dateEnd ||
        filter.stakes ||
        filter.buyInMin ||
        filter.buyInMax ||
        filter.endingMin ||
        filter.endingMax ||
        filter.deltaMin ||
        filter.deltaMax ||
        filter.memo;

      if (hasDetailFilter) {
        return rowMatches(det.before) || rowMatches(det.after);
      }

      return true;
    });
  }, [histories, filter]);

  // ソート
  const sortedHistories = useMemo(() => {
    type FlatHistoryRow = {
      h: HistoryDoc;
      rows: HRow[];
      sortValue: number;
      rep: Partial<BalanceDoc> | undefined;
    };

    const toVal = (h: HistoryDoc, rep?: Partial<BalanceDoc>): number => {
      switch (sortKey) {
        case "changed_at":
          return h.changed_at?.toMillis?.() ?? 0;
        case "date": {
          const d = rep?.date;
          return d ? new Date(d).setHours(0, 0, 0, 0) : 0;
        }
        case "buy_in_bb":
          return Number(rep?.buy_in_bb) || 0;
        case "ending_bb":
          return Number(rep?.ending_bb) || 0;
        case "delta":
          return (Number(rep?.ending_bb) || 0) - (Number(rep?.buy_in_bb) || 0);
        default:
          return 0;
      }
    };

    const flats: FlatHistoryRow[] = historiesFiltered.map((h) => {
      const rows = expandHistory(h);
      const after = rows.find((r) => r.kind === "after")?.b;
      const before = rows.find((r) => r.kind === "before")?.b;
      const rep = after ?? before ?? rows[0]?.b;
      return {
        h,
        rows,
        rep,
        sortValue: toVal(h, rep),
      };
    });

    flats.sort((a, b) =>
      sortDir === "asc"
        ? a.sortValue - b.sortValue
        : b.sortValue - a.sortValue
    );

    return flats;
  }, [historiesFiltered, sortKey, sortDir]);

  const toggleSort = (k: HSortKey) => {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir("asc");
    } else {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    }
  };

  return {
    filter,
    setFilter,
    sortKey,
    sortDir,
    toggleSort,
    historiesFiltered: sortedHistories, // UIで使いやすいようにソート済みを返す
    
    // フィルタ有無判定用
    hasActiveFilter: Object.values(filter).some((v) => v !== ""),
    clearFilter: () => setFilter(INITIAL_HISTORY_FILTER),
  };
}
