import { useState } from "react";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { randDigits } from "../utils/poker";
import type {
  BalanceDoc,
  BalanceRow,
  GroupDoc,
  PlayerDoc,
} from "../types/poker";

type ActionsProps = {
  groupId?: string;
  user: any; // Firebase User
  me: PlayerDoc | null;
  group: GroupDoc | null;
  setMyBalances: React.Dispatch<React.SetStateAction<BalanceRow[]>>;
  setAllBalances: React.Dispatch<React.SetStateAction<BalanceRow[]>>;
  setMe: React.Dispatch<React.SetStateAction<PlayerDoc | null>>;
  onCloseReport?: () => void;
  onCloseEdit?: () => void;
  onCloseDelete?: () => void;
};

export function usePlayerActions({
  groupId,
  user,
  me,
  group,
  setMyBalances,
  setAllBalances,
  setMe,
  onCloseReport,
  onCloseEdit,
  onCloseDelete,
}: ActionsProps) {
  const [deleting, setDeleting] = useState(false);

  // Helper: Write history
  async function writeHistory(
    change_category: "create" | "update" | "delete",
    targetBalanceId: number,
    details: any
  ) {
    if (!groupId || !user || !me) return;
    await addDoc(collection(db, "groups", groupId, "balance_histories"), {
      history_id: parseInt(randDigits(9), 10),
      balance_id: targetBalanceId,
      changed_at: serverTimestamp(),
      change_category,
      change_details: details,
      changer_uid: user.uid,
      changer_player_id: me.player_id,
    });
  }

  // Action: Submit Balance (Create)
  const submitBalance = async (data: {
    date: string;
    sb: number;
    bb: number;
    buyIn: number;
    ending: number;
    memo: string;
  }) => {
    if (!groupId || !user || !me || !group) return;

    const { date, sb, bb, buyIn, ending, memo } = data;

    try {
      const stakesStr = `${sb}/${bb}`;

      const balance: BalanceDoc = {
        balance_id: parseInt(randDigits(9), 10),
        group_id: group.group_id,
        player_id: me.player_id,
        player_uid: user.uid,
        date: date,
        date_ts: Timestamp.fromDate(new Date(date + "T00:00:00")),
        stakes: stakesStr,
        buy_in_bb: buyIn,
        ending_bb: ending,
        memo: memo || "",
        last_updated: serverTimestamp(),
        is_deleted: false,
      };

      const ref = await addDoc(
        collection(db, "groups", groupId, "balances"),
        balance
      );
      // Update local state immediately
      const row: BalanceRow = {
        __id: ref.id,
        ...balance,
        last_updated: Timestamp.now(),
      };
      setMyBalances((prev) => [row, ...prev]);
      setAllBalances((prev) => [row, ...prev]);

      // Update total balance (simple calculation)
      const delta = ending - buyIn;
      await updateDoc(doc(db, "groups", groupId, "players", user.uid), {
        total_balance: (me.total_balance ?? 0) + delta,
      });
      setMe((prev) =>
        prev
          ? { ...prev, total_balance: (prev.total_balance ?? 0) + delta }
          : prev
      );

      await updateDoc(doc(db, "groups", groupId), {
        last_updated: serverTimestamp(),
      });

      // Write history
      await writeHistory("create", balance.balance_id, { after: balance });

      onCloseReport?.();
    } catch (e) {
      console.error(e);
      alert("収支の登録に失敗しました");
      throw e;
    }
  };

  // Action: Save Edit
  const saveEdit = async (
    menuTarget: BalanceRow,
    data: {
      date: string;
      sb: number;
      bb: number;
      buyIn: number;
      ending: number;
      memo: string;
    }
  ) => {
    if (!groupId || !user || !me || !menuTarget) return;

    try {
      const { date, sb, bb, buyIn, ending, memo } = data;
      const ref = doc(db, "groups", groupId, "balances", menuTarget.__id);

      const before = { ...menuTarget };
      const deltaBefore = menuTarget.ending_bb - menuTarget.buy_in_bb;

      const patch = {
        date,
        date_ts: Timestamp.fromDate(new Date(date + "T00:00:00")),
        stakes: `${sb}/${bb}`,
        buy_in_bb: buyIn,
        ending_bb: ending,
        memo,
        last_updated: serverTimestamp(),
      };

      await updateDoc(ref, patch);

      // Update local state
      setMyBalances((prev) =>
        prev.map((x) => (x.__id === menuTarget.__id ? { ...x, ...patch } : x))
      );
      setAllBalances((prev) =>
        prev.map((x) => (x.__id === menuTarget.__id ? { ...x, ...patch } : x))
      );

      // Update total balance (diff)
      const deltaAfter = ending - buyIn;
      const deltaDiff = deltaAfter - deltaBefore;
      await updateDoc(doc(db, "groups", groupId, "players", user.uid), {
        total_balance: (me.total_balance ?? 0) + deltaDiff,
      });
      setMe((prev) =>
        prev
          ? { ...prev, total_balance: (prev.total_balance ?? 0) + deltaDiff }
          : prev
      );

      await updateDoc(doc(db, "groups", groupId), {
        last_updated: serverTimestamp(),
      });

      // Write history
      await writeHistory("update", before.balance_id, { before, after: patch });

      onCloseEdit?.();
    } catch (e) {
      console.error(e);
      alert("編集に失敗しました");
      throw e;
    }
  };

  // Action: Delete
  const doDelete = async (menuTarget: BalanceRow) => {
    if (!groupId || !user || !me || !menuTarget) return;
    setDeleting(true);
    try {
      const ref = doc(db, "groups", groupId, "balances", menuTarget.__id);
      const before = { ...menuTarget };

      await updateDoc(ref, {
        is_deleted: true,
        last_updated: serverTimestamp(),
      });

      // Remove from local state
      setMyBalances((prev) => prev.filter((x) => x.__id !== menuTarget.__id));
      setAllBalances((prev) => prev.filter((x) => x.__id !== menuTarget.__id));

      // Revert total balance
      const delta = menuTarget.ending_bb - menuTarget.buy_in_bb;
      await updateDoc(doc(db, "groups", groupId, "players", user.uid), {
        total_balance: (me.total_balance ?? 0) - delta,
      });
      setMe((prev) =>
        prev
          ? { ...prev, total_balance: (prev.total_balance ?? 0) - delta }
          : prev
      );

      await updateDoc(doc(db, "groups", groupId), {
        last_updated: serverTimestamp(),
      });

      // Write history
      await writeHistory("delete", before.balance_id, { before });

      onCloseDelete?.();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  return {
    submitBalance,
    saveEdit,
    doDelete,
    deleting,
  };
}
