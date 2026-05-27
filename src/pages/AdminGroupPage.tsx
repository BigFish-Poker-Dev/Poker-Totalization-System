import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../lib/firebase";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type {
  BalanceDoc,
  BalanceRow,
  GroupDoc,
  HistoryDoc,
  PlayerDoc,
} from "../types/poker";
import {
  deltaInUnit,
  getReportUnit,
  creatorNameOf,
  pad6,
  randDigits,
  unitLabel,
} from "../utils/poker";
import TabButton from "../components/TabButton";
import RankingTable from "../components/RankingTable";
import BalanceDatabaseView from "../components/BalanceDatabaseView";
import HistoryList from "../components/HistoryList";
import GroupSettingsForm from "../components/GroupSettingsForm";
import RankingTransitionGraph from "../components/RankingTransitionGraph";
import BalanceFormModal from "../components/BalanceFormModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { useBalanceFilter } from "../hooks/useBalanceFilter";
import { ensureMissingRankingColors } from "../utils/playerColors";

// ========== ページ本体 ==========
export default function AdminGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const TABS = [
    "グループ設定",
    "収支ランキング",
    "収支一覧",
    "更新履歴",
  ] as const;
  type TabType = (typeof TABS)[number];
  const [tab, setTab] = useState<TabType>("グループ設定");

  const [group, setGroup] = useState<GroupDoc | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerDoc>>({});
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [histories, setHistories] = useState<HistoryDoc[]>([]);
  const [menuTarget, setMenuTarget] = useState<BalanceRow | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    (async () => {
      if (!groupId) return;

      // group
      const gref = doc(db, "groups", groupId);
      const gsnap = await getDoc(gref);
      if (gsnap.exists()) {
        const g = gsnap.data() as GroupDoc;
        setGroup(g);
      }

      // players
      const plist = await getDocs(collection(db, "groups", groupId, "players"));
      const pmap: Record<string, PlayerDoc> = {};
      plist.docs.forEach((d) => (pmap[d.id] = d.data() as PlayerDoc));
      const coloredPlayers = await ensureMissingRankingColors(groupId, pmap);
      setPlayers(coloredPlayers);

      // balances（ランキング用）
      const bq = query(
        collection(db, "groups", groupId, "balances"),
        where("is_deleted", "==", false)
      );
      const bs = await getDocs(bq);
      setBalances(
        bs.docs.map((d) => ({ __id: d.id, ...(d.data() as BalanceDoc) }))
      );

      // histories（新しい順）
      const hq = query(
        collection(db, "groups", groupId, "balance_histories"),
        orderBy("changed_at", "desc")
      );
      const hs = await getDocs(hq);
      setHistories(hs.docs.map((d) => d.data() as HistoryDoc));
    })();
  }, [groupId]);

  const reportUnit = getReportUnit(group);
  const balanceHook = useBalanceFilter(balances, "last_updated", "desc", reportUnit);

  const saveAdminEdit = async (
    target: BalanceRow,
    data: {
      date: string;
      sb: number;
      bb: number;
      buyIn: number;
      ending: number;
      memo: string;
    }
  ) => {
    if (!groupId || !group) return;

    const before = { ...target };
    const reportUnit = getReportUnit(group);
    const deltaBefore = deltaInUnit(target, reportUnit, group);
    const patch = {
      date: data.date,
      date_ts: Timestamp.fromDate(new Date(data.date + "T00:00:00")),
      stakes: reportUnit === "bb" ? `${data.sb}/${data.bb}` : "",
      report_unit: reportUnit,
      buy_in: data.buyIn,
      ending: data.ending,
      memo: data.memo,
      last_updated: serverTimestamp(),
    };
    const deltaAfter = deltaInUnit({ ...before, ...patch }, reportUnit, group);
    const deltaDiff = deltaAfter - deltaBefore;
    const history: HistoryDoc = {
      history_id: parseInt(randDigits(9), 10),
      balance_id: target.balance_id,
      changed_at: Timestamp.now(),
      change_category: "update",
      change_details: { before, after: patch },
      changer_uid: "admin",
      changer_player_id: 0,
    };

    await updateDoc(
      doc(db, "groups", groupId, "balances", target.__id),
      patch
    );

    await updateDoc(
      doc(db, "groups", groupId, "players", target.player_uid),
      {
        total_balance:
          (players[target.player_uid]?.total_balance ?? 0) + deltaDiff,
      }
    );

    await updateDoc(doc(db, "groups", groupId), {
      last_updated: serverTimestamp(),
    });

    await addDoc(collection(db, "groups", groupId, "balance_histories"), {
      ...history,
      changed_at: serverTimestamp(),
    });

    setBalances((prev) =>
      prev.map((balance) =>
        balance.__id === target.__id
          ? { ...balance, ...patch, last_updated: Timestamp.now() }
          : balance
      )
    );
    setPlayers((prev) => ({
      ...prev,
      [target.player_uid]: {
        ...prev[target.player_uid],
        total_balance:
          (prev[target.player_uid]?.total_balance ?? 0) + deltaDiff,
      },
    }));
    setHistories((prev) => [history, ...prev]);
    setOpenEdit(false);
    setMenuTarget(null);
  };

  const deleteAdminBalance = async () => {
    if (!groupId || !group || !menuTarget) return;
    setDeleting(true);
    try {
      const before = { ...menuTarget };
      const reportUnit = getReportUnit(group);
      const delta = deltaInUnit(menuTarget, reportUnit, group);
      const history: HistoryDoc = {
        history_id: parseInt(randDigits(9), 10),
        balance_id: menuTarget.balance_id,
        changed_at: Timestamp.now(),
        change_category: "delete",
        change_details: { before },
        changer_uid: "admin",
        changer_player_id: 0,
      };

      await updateDoc(
        doc(db, "groups", groupId, "balances", menuTarget.__id),
        {
          is_deleted: true,
          last_updated: serverTimestamp(),
        }
      );

      await updateDoc(
        doc(db, "groups", groupId, "players", menuTarget.player_uid),
        {
          total_balance:
            (players[menuTarget.player_uid]?.total_balance ?? 0) - delta,
        }
      );

      await updateDoc(doc(db, "groups", groupId), {
        last_updated: serverTimestamp(),
      });

      await addDoc(collection(db, "groups", groupId, "balance_histories"), {
        ...history,
        changed_at: serverTimestamp(),
      });

      setBalances((prev) =>
        prev.filter((balance) => balance.__id !== menuTarget.__id)
      );
      setPlayers((prev) => ({
        ...prev,
        [menuTarget.player_uid]: {
          ...prev[menuTarget.player_uid],
          total_balance:
            (prev[menuTarget.player_uid]?.total_balance ?? 0) - delta,
        },
      }));
      setHistories((prev) => [history, ...prev]);
      setOpenDelete(false);
      setMenuTarget(null);
    } catch (error) {
      console.error(error);
      alert("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };



  if (!group) return <div style={{ padding: 24 }}>Loading...</div>;

  const summaryStatus = group.balance_summary_status ?? "OnGoing";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 1080,
          maxWidth: "96vw",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 10px 28px rgba(0,0,0,.08)",
          padding: 24,
        }}
      >
        {/* ヘッダ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Admin: {group.group_name}{" "}
              <span style={{ opacity: 0.6, fontSize: 14 }}>
                ID {pad6(group.group_id)}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginLeft: 10,
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  verticalAlign: "middle",
                  color: summaryStatus === "Archive" ? "#9a3412" : "#166534",
                  background:
                    summaryStatus === "Archive" ? "#ffedd5" : "#dcfce7",
                  border:
                    summaryStatus === "Archive"
                      ? "1px solid #fdba74"
                      : "1px solid #86efac",
                }}
              >
                {summaryStatus}
              </span>
            </h2>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              作成者: {creatorNameOf(group)}
            </div>
          </div>
          <Link
            to="/admin"
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          >
            グループ一覧へ
          </Link>
        </div>

        <hr style={{ margin: "16px 0 12px" }} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <TabButton key={t} active={tab === t} onClick={() => setTab(t)}>
              {t}
            </TabButton>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {/* ========== グループ設定 ========== */}
          {tab === "グループ設定" && (
            <GroupSettingsForm group={group} onUpdate={setGroup} />
          )}

          {/* ========== 収支ランキング ========== */}
          {tab === "収支ランキング" && (
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                全員のランキング（累計{unitLabel(reportUnit)}）
              </h3>
              <RankingTransitionGraph
                balances={balances}
                players={players}
                title="全員のランキング推移"
                reportUnit={reportUnit}
              />
              <div style={{ height: 16 }} />
              {/* Use shared component */}
              <RankingTable
                balances={balances}
                players={players}
                reportUnit={reportUnit}
              />
            </div>
          )}

          {/* ========== 収支一覧 ========== */}
          {tab === "収支一覧" && (
            <BalanceDatabaseView
              players={players}
              mode="admin"
              {...balanceHook}
              reportUnit={reportUnit}
              onAction={(balance) => {
                setMenuTarget(balance);
                setOpenEdit(true);
              }}
            />
          )}

          {/* ========== 更新履歴 ========== */}
          {tab === "更新履歴" && (
            <HistoryList
              histories={histories}
              players={players}
              reportUnit={reportUnit}
            />
          )}
        </div>
      </div>

      <BalanceFormModal
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setMenuTarget(null);
        }}
        balance={menuTarget}
        group={group}
        onSave={async (data) => {
          if (menuTarget) await saveAdminEdit(menuTarget, data);
        }}
        onDeleteRequest={() => {
          setOpenEdit(false);
          setOpenDelete(true);
        }}
      />

      <DeleteConfirmModal
        open={openDelete}
        onClose={() => {
          setOpenDelete(false);
          setMenuTarget(null);
        }}
        onDelete={deleteAdminBalance}
        deleting={deleting}
      />
    </div>
  );
}
