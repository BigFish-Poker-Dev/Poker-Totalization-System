import { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { pad6, parseLegacyStakes } from "../utils/poker";
import type { GroupDoc, GroupSettings } from "../types/poker";

type Props = {
  group: GroupDoc;
  onUpdate: (updatedGroup: GroupDoc) => void;
};

export default function GroupSettingsForm({ group, onUpdate }: Props) {
  const [stakesFixed, setStakesFixed] = useState(false);
  const [stakesSB, setStakesSB] = useState<string>("");
  const [stakesBB, setStakesBB] = useState<string>("");
  const [topN, setTopN] = useState<number>(10);
  const [newName, setNewName] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!group) return;
    const s = group.settings;
    setStakesFixed(!!s?.stakes_fixed);

    // 新仕様: stakes_sb/ stakes_bb 優先、なければ旧 stakes_value をパース
    const sb0 =
      typeof s?.stakes_sb === "number"
        ? s!.stakes_sb
        : parseLegacyStakes(s?.stakes_value).sb;
    const bb0 =
      typeof s?.stakes_bb === "number"
        ? s!.stakes_bb
        : parseLegacyStakes(s?.stakes_value).bb;

    setStakesSB(sb0 != null ? String(sb0) : "");
    setStakesBB(bb0 != null ? String(bb0) : "");
    setTopN(s?.ranking_top_n ?? 10);
    setNewName(group.group_name);
  }, [group]);

  async function saveSettings() {
    if (!group) return;

    const fixed = stakesFixed;
    const sb = Number(stakesSB);
    const bb = Number(stakesBB);

    if (fixed) {
      if (isNaN(sb) || isNaN(bb) || sb <= 0 || bb <= 0) {
        alert("固定SB/BB は 0 より大きい数値で入力してください");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        settings: {
          stakes_fixed: fixed,
          stakes_sb: fixed ? sb : null,
          stakes_bb: fixed ? bb : null,
          // 後方互換: 旧 stakes_value は使わない（null推奨）
          stakes_value: null,
          ranking_top_n: Number(topN) || 10,
        } as GroupSettings,
        group_name: newName || group.group_name,
        last_updated: serverTimestamp(),
      };
      await updateDoc(doc(db, "groups", String(group.group_id)), payload);
      const updated = { ...group, ...payload } as GroupDoc;
      onUpdate(updated);
      alert("保存しました");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* 1) ステークス固定（SB/BB） */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>1) ステークス固定（SB/BB）</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={stakesFixed}
            onChange={(e) => setStakesFixed(e.target.checked)}
          />
          ステークスを固定する
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 8,
          }}
        >
          <div>
            <label style={lbl}>固定SB</label>
            <input
              value={stakesSB}
              onChange={(e) =>
                setStakesSB(e.target.value.replace(/[^0-9.]/g, ""))
              }
              inputMode="decimal"
              placeholder="例: 1"
              disabled={!stakesFixed}
              style={inp}
            />
          </div>
          <div>
            <label style={lbl}>固定BB</label>
            <input
              value={stakesBB}
              onChange={(e) =>
                setStakesBB(e.target.value.replace(/[^0-9.]/g, ""))
              }
              inputMode="decimal"
              placeholder="例: 3"
              disabled={!stakesFixed}
              style={inp}
            />
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          ※ 固定ONの場合、Player の「収支報告」「編集」では SB/BB
          がこの固定値で表示され、編集できません。
        </div>
      </div>

      {/* 2) ランキング上位N */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>2) Player公開ランキングの上位N</h3>
        <input
          value={topN}
          onChange={(e) =>
            setTopN(Number(e.target.value.replace(/\D/g, "")) || 10)
          }
          inputMode="numeric"
          style={{
            width: 180,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
      </div>

      {/* 3) グループ名変更・ID/PW */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          3) グループ名の変更 / ID・パスワード確認
        </h3>
        <label style={lbl}>グループ名</label>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 480,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
        <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.8 }}>
          <div>
            グループID: <code>{pad6(group.group_id)}</code>
          </div>
          <div>
            Player PW: <code>{group.player_password}</code>
          </div>
          <div>
            Admin PW: <code>{group.admin_password}</code>
          </div>
        </div>
      </div>

      <div>
        <button
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
          }}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}
