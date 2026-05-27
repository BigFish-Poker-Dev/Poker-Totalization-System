import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import Modal from "./Modal";
import { getFixedStakes, getReportUnit, pad6, parseLegacyStakes } from "../utils/poker";
import type { GroupDoc, GroupSettings } from "../types/poker";

type Props = {
  group: GroupDoc;
  onUpdate: (updatedGroup: GroupDoc) => void;
};

type SummaryStatus = "OnGoing" | "Archive";

export default function GroupSettingsForm({ group, onUpdate }: Props) {
  const navigate = useNavigate();
  const [openEdit, setOpenEdit] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [reportUnit, setReportUnit] = useState<"bb" | "points">("bb");
  const [stakesFixed, setStakesFixed] = useState(false);
  const [stakesSB, setStakesSB] = useState("");
  const [stakesBB, setStakesBB] = useState("");
  const [topN, setTopN] = useState("10");
  const [groupName, setGroupName] = useState("");
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("OnGoing");
  const [saving, setSaving] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [openDangerConfirm, setOpenDangerConfirm] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

  const currentReportUnit = getReportUnit(group);
  const currentFixedStakes = getFixedStakes(group);
  const currentStakesFixed = currentReportUnit === "bb" ? !!group.settings?.stakes_fixed : false;
  const currentTopN = group.settings?.ranking_top_n ?? 10;
  const currentSummaryStatus = group.balance_summary_status ?? "OnGoing";
  const fixedStakesEnabled = reportUnit === "bb";

  useEffect(() => {
    syncForm(group);
  }, [group]);

  function syncForm(target: GroupDoc) {
    const settings = target.settings;
    const parsedLegacy = parseLegacyStakes(settings?.stakes_value);
    const sb =
      typeof settings?.stakes_sb === "number" ? settings.stakes_sb : parsedLegacy.sb;
    const bb =
      typeof settings?.stakes_bb === "number" ? settings.stakes_bb : parsedLegacy.bb;

    setReportUnit(settings?.report_unit === "points" ? "points" : "bb");
    setStakesFixed(settings?.report_unit === "points" ? false : !!settings?.stakes_fixed);
    setStakesSB(sb != null ? String(sb) : "");
    setStakesBB(bb != null ? String(bb) : "");
    setTopN(String(settings?.ranking_top_n ?? 10));
    setGroupName(target.group_name);
    setSummaryStatus(target.balance_summary_status ?? "OnGoing");
  }

  const payload = useMemo(() => {
    const currentLegacy = parseLegacyStakes(group.settings?.stakes_value);
    const preservedSb =
      typeof group.settings?.stakes_sb === "number"
        ? group.settings.stakes_sb
        : currentLegacy.sb;
    const preservedBb =
      typeof group.settings?.stakes_bb === "number"
        ? group.settings.stakes_bb
        : currentLegacy.bb;
    const parsedTopN = Math.max(1, Number(topN.replace(/\D/g, "")) || 10);
    const effectiveFixed = reportUnit === "bb" ? stakesFixed : false;
    const nextSb = effectiveFixed ? Number(stakesSB) : preservedSb ?? null;
    const nextBb = effectiveFixed ? Number(stakesBB) : preservedBb ?? null;

    return {
      settings: {
        report_unit: reportUnit,
        stakes_fixed: effectiveFixed,
        stakes_sb: nextSb,
        stakes_bb: nextBb,
        stakes_value: null,
        ranking_top_n: parsedTopN,
      } as GroupSettings,
      group_name: groupName.trim(),
      balance_summary_status: summaryStatus,
    };
  }, [group, groupName, reportUnit, stakesBB, stakesFixed, stakesSB, summaryStatus, topN]);

  const regularChanged = useMemo(() => {
    if (reportUnit !== currentReportUnit) return true;
    if ((reportUnit === "bb" ? stakesFixed : false) !== currentStakesFixed) {
      return true;
    }
    if ((Number(topN.replace(/\D/g, "")) || 10) !== currentTopN) return true;
    if (reportUnit === "bb" && stakesFixed) {
      if (Number(stakesSB) !== (currentFixedStakes?.sb ?? NaN)) return true;
      if (Number(stakesBB) !== (currentFixedStakes?.bb ?? NaN)) return true;
    }
    return false;
  }, [
    currentFixedStakes?.bb,
    currentFixedStakes?.sb,
    currentReportUnit,
    currentTopN,
    currentStakesFixed,
    reportUnit,
    stakesBB,
    stakesFixed,
    stakesSB,
    topN,
  ]);

  const groupNameChanged = groupName.trim() !== group.group_name;
  const summaryStatusChanged = summaryStatus !== currentSummaryStatus;
  const dangerChanged = groupNameChanged || summaryStatusChanged;
  const hasChanges = regularChanged || dangerChanged;

  async function saveSettings() {
    if (!hasChanges) return;

    if (!payload.group_name) {
      alert("グループ名を入力してください");
      return;
    }

    if (payload.settings.ranking_top_n <= 0) {
      alert("公開ランキングの上位Nには 1 以上を入力してください");
      return;
    }

    if (payload.settings.report_unit === "bb" && payload.settings.stakes_fixed) {
      if (
        !Number.isFinite(payload.settings.stakes_sb) ||
        !Number.isFinite(payload.settings.stakes_bb) ||
        Number(payload.settings.stakes_sb) <= 0 ||
        Number(payload.settings.stakes_bb) <= 0
      ) {
        alert("固定ステークスは 0 より大きい数値で入力してください");
        return;
      }
    }

    if (dangerChanged) {
      setOpenDangerConfirm(true);
      return;
    }

    await persistSettings();
  }

  async function persistSettings() {
    setSaving(true);
    try {
      const docId = pad6(group.group_id);
      const updatePayload = {
        ...payload,
        last_updated: serverTimestamp(),
      };
      await updateDoc(doc(db, "groups", docId), updatePayload);
      onUpdate({ ...group, ...payload });
      setOpenDangerConfirm(false);
      setOpenEdit(false);
      setShowDangerZone(false);
      alert("保存しました");
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    setDeletingGroup(true);
    try {
      const docId = pad6(group.group_id);
      const [
        playersSnap,
        balancesSnap,
        historiesSnap,
        adminMembershipsSnap,
        playerMembershipsSnap,
      ] = await Promise.all([
        getDocs(collection(db, "groups", docId, "players")),
        getDocs(collection(db, "groups", docId, "balances")),
        getDocs(collection(db, "groups", docId, "balance_histories")),
        getDocs(
          query(collection(db, "group_admins"), where("group_id", "==", group.group_id)),
        ),
        getDocs(
          query(collection(db, "group_players"), where("group_id", "==", group.group_id)),
        ),
      ]);

      await deleteSnapshotsInBatches(playersSnap.docs);
      await deleteSnapshotsInBatches(balancesSnap.docs);
      await deleteSnapshotsInBatches(historiesSnap.docs);
      await deleteSnapshotsInBatches(adminMembershipsSnap.docs);
      await deleteSnapshotsInBatches(playerMembershipsSnap.docs);

      const batch = writeBatch(db);
      batch.delete(doc(db, "groups", docId));
      await batch.commit();

      setOpenDeleteConfirm(false);
      setOpenEdit(false);
      alert("グループを削除しました");
      navigate("/admin");
    } catch (error) {
      console.error(error);
      alert("グループ削除に失敗しました");
    } finally {
      setDeletingGroup(false);
    }
  }

  function openEditor() {
    syncForm(group);
    setShowDangerZone(false);
    setOpenDangerConfirm(false);
    setOpenDeleteConfirm(false);
    setOpenEdit(true);
  }

  return (
    <>
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>グループ設定</h3>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
              現在の設定を確認できます。変更はモーダルから行います。
            </div>
          </div>
          <button onClick={openEditor} style={primaryButton}>
            変更
          </button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <section style={sectionCard}>
            <h4 style={sectionTitle}>1) グループ名 / ID・パスワード</h4>
            <div style={fieldLabel}>グループ名</div>
            <div style={displayValue}>{group.group_name}</div>
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.8 }}>
              <div>
                グループID: <span style={monoValueInline}>{pad6(group.group_id)}</span>
              </div>
              <div>
                Player PW: <span style={monoValueInline}>{group.player_password}</span>
              </div>
              <div>
                Admin PW: <span style={monoValueInline}>{group.admin_password}</span>
              </div>
            </div>
          </section>

          <section style={sectionCard}>
            <h4 style={sectionTitle}>2) 報告・表示形式</h4>
            <div style={displayValue}>
              {currentReportUnit === "bb"
                ? "BB数で収支を報告・表示"
                : "点数で収支を報告・表示"}
            </div>
          </section>

          <section style={sectionCard}>
            <h4 style={sectionTitle}>3) ステークス</h4>
            <div style={displayValue}>{formatStakesSummary(group)}</div>
          </section>

          <section style={sectionCard}>
            <h4 style={sectionTitle}>4) Player公開ランキングの上位N</h4>
            <div style={displayValue}>{currentTopN}位まで公開</div>
          </section>

          <section style={sectionCard}>
            <h4 style={sectionTitle}>5) 収支集計の状態</h4>
            <div style={displayValue}>{currentSummaryStatus}</div>
          </section>
        </div>
      </div>

      <Modal
        open={openEdit}
        onClose={() => {
          if (saving || deletingGroup) return;
          setOpenEdit(false);
          setShowDangerZone(false);
        }}
        width={680}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>グループ設定の変更</h3>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                変更がある場合のみ保存できます。
              </div>
            </div>
            <button
              onClick={() => {
                if (saving || deletingGroup) return;
                setOpenEdit(false);
                setShowDangerZone(false);
              }}
              style={secondaryButton}
            >
              閉じる
            </button>
          </div>

          <section style={sectionCard}>
            <h4 style={sectionTitle}>報告・表示形式</h4>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={radioRow}>
                <input
                  type="radio"
                  name="report_unit"
                  checked={reportUnit === "bb"}
                  onChange={() => setReportUnit("bb")}
                />
                BB数で収支を報告・表示する
              </label>
              <label style={radioRow}>
                <input
                  type="radio"
                  name="report_unit"
                  checked={reportUnit === "points"}
                  onChange={() => {
                    setReportUnit("points");
                    setStakesFixed(false);
                  }}
                />
                点数で収支を報告・表示する
              </label>
            </div>
          </section>

          <section
            style={{
              ...sectionCard,
              opacity: fixedStakesEnabled ? 1 : 0.6,
            }}
          >
            <h4 style={sectionTitle}>ステークス</h4>
            <label style={radioRow}>
              <input
                type="checkbox"
                checked={stakesFixed}
                disabled={!fixedStakesEnabled}
                onChange={(event) => setStakesFixed(event.target.checked)}
              />
              ステークスを固定する
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginTop: 12,
              }}
            >
              <div>
                <label style={fieldLabel}>固定SB</label>
                <input
                  value={stakesSB}
                  onChange={(event) =>
                    setStakesSB(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="例: 1"
                  disabled={!fixedStakesEnabled || !stakesFixed}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>固定BB</label>
                <input
                  value={stakesBB}
                  onChange={(event) =>
                    setStakesBB(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="例: 3"
                  disabled={!fixedStakesEnabled || !stakesFixed}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={noteText}>
              BB数での報告時のみ有効です。固定ONの場合、Player側ではこの値で収支報告を行います。
            </div>
          </section>

          <section style={sectionCard}>
            <h4 style={sectionTitle}>Player公開ランキングの上位N</h4>
            <input
              value={topN}
              onChange={(event) =>
                setTopN(event.target.value.replace(/\D/g, "").slice(0, 3))
              }
              inputMode="numeric"
              style={{ ...inputStyle, maxWidth: 180 }}
            />
          </section>

          <section style={sectionCard}>
            <button
              onClick={() => setShowDangerZone((prev) => !prev)}
              style={{
                ...secondaryButton,
                color: "#b42318",
                borderColor: "#f0b3ad",
                background: showDangerZone ? "#fff5f3" : "#fff",
              }}
            >
              {showDangerZone ? "Danger Zoneを閉じる" : "Danger Zoneを開く"}
            </button>

            {showDangerZone && (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: "1px solid #f3d2cf",
                }}
              >
                <div>
                  <h4 style={{ ...sectionTitle, color: "#b42318" }}>Danger Zone</h4>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    ここでの変更は確認モーダルを経由して保存されます。
                  </div>
                </div>

                <div>
                  <label style={fieldLabel}>グループ名</label>
                  <input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={fieldLabel}>収支集計の状態</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["OnGoing", "Archive"] as const).map((status) => (
                      <label key={status} style={radioRow}>
                        <input
                          type="radio"
                          name="summary_status"
                          checked={summaryStatus === status}
                          onChange={() => setSummaryStatus(status)}
                        />
                        {status}
                      </label>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #f3d2cf",
                    borderRadius: 12,
                    padding: 16,
                    background: "#fff7f6",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#b42318" }}>グループ削除</div>
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                    グループ本体、所属情報、Players、収支データ、履歴を削除します。
                  </div>
                  <button
                    onClick={() => setOpenDeleteConfirm(true)}
                    style={{
                      ...secondaryButton,
                      marginTop: 14,
                      color: "#b42318",
                      borderColor: "#f0b3ad",
                      background: "#fff",
                    }}
                  >
                    グループを削除
                  </button>
                </div>
              </div>
            )}
          </section>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => {
                if (saving || deletingGroup) return;
                setOpenEdit(false);
                setShowDangerZone(false);
              }}
              style={secondaryButton}
            >
              キャンセル
            </button>
            <button
              onClick={saveSettings}
              disabled={!hasChanges || saving || deletingGroup}
              style={{
                ...primaryButton,
                opacity: !hasChanges || saving || deletingGroup ? 0.55 : 1,
                cursor:
                  !hasChanges || saving || deletingGroup ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "保存中..." : dangerChanged ? "確認して保存" : "保存する"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openDangerConfirm}
        onClose={() => {
          if (saving) return;
          setOpenDangerConfirm(false);
        }}
        width={420}
      >
        <h3 style={{ marginTop: 0, color: "#b42318" }}>Danger Zoneの変更確認</h3>
        <div style={{ lineHeight: 1.7 }}>
          {groupNameChanged && (
            <div>
              グループ名: <strong>{group.group_name}</strong> →{" "}
              <strong>{groupName.trim() || "(未入力)"}</strong>
            </div>
          )}
          {summaryStatusChanged && (
            <div>
              収支集計の状態: <strong>{currentSummaryStatus}</strong> →{" "}
              <strong>{summaryStatus}</strong>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={() => setOpenDangerConfirm(false)} style={secondaryButton}>
            戻る
          </button>
          <button onClick={persistSettings} disabled={saving} style={dangerButton}>
            {saving ? "保存中..." : "この内容で保存"}
          </button>
        </div>
      </Modal>

      <Modal
        open={openDeleteConfirm}
        onClose={() => {
          if (deletingGroup) return;
          setOpenDeleteConfirm(false);
        }}
        width={420}
      >
        <h3 style={{ marginTop: 0, color: "#b42318" }}>グループ削除の確認</h3>
        <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
          <strong>{group.group_name}</strong> を削除しますか。
          <br />
          この操作は取り消せません。
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={() => setOpenDeleteConfirm(false)} style={secondaryButton}>
            キャンセル
          </button>
          <button onClick={deleteGroup} disabled={deletingGroup} style={dangerButton}>
            {deletingGroup ? "削除中..." : "削除する"}
          </button>
        </div>
      </Modal>
    </>
  );
}

async function deleteSnapshotsInBatches(snapshots: Array<{ ref: any }>) {
  const chunkSize = 400;
  for (let i = 0; i < snapshots.length; i += chunkSize) {
    const batch = writeBatch(db);
    snapshots.slice(i, i + chunkSize).forEach((snapshot) => {
      batch.delete(snapshot.ref);
    });
    await batch.commit();
  }
}

function formatStakesSummary(group: GroupDoc) {
  const reportUnit = getReportUnit(group);
  if (reportUnit !== "bb") return "点数表示のため未使用";
  const fixed = getFixedStakes(group);
  if (!group.settings?.stakes_fixed) return "固定しない";
  if (!fixed) return "固定する（値未設定）";
  return `固定する (${fixed.sb}/${fixed.bb})`;
}

const displayValue: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.6,
  wordBreak: "break-word",
};

const monoValueInline: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const sectionCard: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 12px",
};

const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
};

const radioRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #d0d5dd",
};

const noteText: CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  marginTop: 10,
  lineHeight: 1.6,
};

const primaryButton: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #d0d5dd",
  background: "#fff",
  cursor: "pointer",
};

const dangerButton: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#b42318",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
