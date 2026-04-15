import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";
import { randDigits } from "../utils/poker";
import { normalizeColor } from "../utils/playerColors";

// ===== 型 =====
type GroupDoc = {
  group_id: number;
  group_name: string;
  creator: string;
  player_password: string;
  admin_password: string;
  created_at?: any;
  last_updated?: any;
  creator_name?: string;
  creator_uid?: string;
};

type PlayerMembership = {
  group_id: number;
  uid: string;
  joinedAt: any;
};

// ===== ユーティリティ =====
const pad6 = (n: number | string) =>
  String(n).replace(/\D/g, "").padStart(6, "0");

const formatTs = (t?: any) => t?.toDate?.().toLocaleString?.() || "-";

const creatorNameOf = (g?: GroupDoc) =>
  g?.creator_name ||
  (g?.creator && g.creator.includes("@")
    ? g.creator.split("@")[0]
    : g?.creator) ||
  "(unknown)";

export default function PlayerDashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<PlayerMembership[]>([]);
  const [groups, setGroups] = useState<Record<string, GroupDoc>>({});

  // Join Modal
  const [openJoin, setOpenJoin] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState("");
  const [joinPlayerPw, setJoinPlayerPw] = useState("");
  const [joinRankingColor, setJoinRankingColor] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? "" : current));
    }, 3200);
  };

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      setLoading(true);

      // 自分の player membership を取得
      const q = query(
        collection(db, "group_players"),
        where("uid", "==", user.uid)
      );
      const ms = await getDocs(q);
      const items: PlayerMembership[] = ms.docs.map(
        (d) => d.data() as PlayerMembership
      );
      setMemberships(items);

      // 参加グループの詳細を取得
      const map: Record<string, GroupDoc> = {};
      await Promise.all(
        items.map(async (m) => {
          const gidStr = pad6(m.group_id);
          const ref = doc(db, "groups", gidStr);
          const snap = await getDoc(ref);
          if (snap.exists()) map[gidStr] = snap.data() as GroupDoc;
        })
      );
      setGroups(map);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const myGroups = useMemo(() => {
    return memberships
      .map((m) => groups[pad6(m.group_id)])
      .filter((g): g is GroupDoc => !!g)
      .sort(
        (a, b) =>
          (b.last_updated?.seconds ?? 0) - (a.last_updated?.seconds ?? 0) ||
          b.group_id - a.group_id
      );
  }, [memberships, groups]);

  // ========== 既存グループに参加（player用） ==========
  const joinGroupAsPlayer = async () => {
    if (!user) return;
    const gidStr = pad6(joinGroupId);
    const rankingColor = normalizeColor(joinRankingColor);
    if (!/^\d{6}$/.test(gidStr) || !/^\d{6}$/.test(joinPlayerPw.trim())) {
      showToast("グループID（6桁）とPlayerパスワード（6桁）を入力してください");
      return;
    }
    if (!rankingColor) {
      showToast("上位ランキンググラフで表示する自分の色を設定してください");
      return;
    }
    try {
      setJoining(true);
      const ref = doc(db, "groups", gidStr);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        showToast("グループが見つかりません");
        setJoining(false);
        return;
      }
      const data = snap.data() as GroupDoc;

      if (data.player_password !== joinPlayerPw.trim()) {
        showToast("Playerパスワードが一致しません");
        setJoining(false);
        return;
      }

      const playersSnap = await getDocs(
        collection(db, "groups", gidStr, "players")
      );
      const duplicateColor = playersSnap.docs.some((playerDoc) => {
        if (playerDoc.id === user.uid) return false;
        const playerColor = normalizeColor(
          (playerDoc.data() as { ranking_color?: string }).ranking_color ?? ""
        );
        return playerColor === rankingColor;
      });
      if (duplicateColor) {
        showToast("他のプレイヤーと同じ色です。別の色を選択してください");
        setJoining(false);
        return;
      }

      // 所属登録（"XXXXXX_uid"）
      await setDoc(doc(db, "group_players", `${gidStr}_${user.uid}`), {
        group_id: data.group_id,
        uid: user.uid,
        joinedAt: serverTimestamp(),
      });

      const playerRef = doc(db, "groups", gidStr, "players", user.uid);
      const playerSnap = await getDoc(playerRef);
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const displayName =
        (userSnap.exists()
          ? (userSnap.data() as { display_name?: string }).display_name
          : "") ||
        user.displayName ||
        "No Name";
      const existingPlayer = playerSnap.exists()
        ? (playerSnap.data() as any)
        : null;
      await setDoc(
        playerRef,
        {
          player_id:
            existingPlayer?.player_id ?? parseInt(randDigits(6), 10),
          group_id: data.group_id,
          display_name: existingPlayer?.display_name ?? displayName,
          email: existingPlayer?.email ?? user.email ?? "",
          total_balance: existingPlayer?.total_balance ?? 0,
          ranking_color: rankingColor,
        },
        { merge: true }
      );

      await updateDoc(doc(db, "groups", gidStr), {
        last_updated: serverTimestamp(),
      });

      // ローカル更新
      setMemberships((prev) => {
        if (prev.some((p) => pad6(p.group_id) === gidStr)) return prev;
        return [
          ...prev,
          {
            group_id: data.group_id,
            uid: user.uid,
            joinedAt: new Date(),
          } as any,
        ];
      });
      setGroups((prev) => ({ ...prev, [gidStr]: data }));

      showToast("グループに参加しました。");
      setOpenJoin(false);
      setJoinGroupId("");
      setJoinPlayerPw("");
      setJoinRankingColor("");
    } catch (e) {
      console.error(e);
      showToast("参加に失敗しました。コンソールを確認してください。");
    } finally {
      setJoining(false);
    }
  };

  if (!user) {
    return <div style={{ padding: 24 }}>ログインしてください。</div>;
  }

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
          width: 960,
          maxWidth: "96vw",
          padding: 24,
          borderRadius: 16,
          boxShadow: "0 10px 28px rgba(0,0,0,.08)",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Player ダッシュボード</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to="/admin"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            >
              Admin ダッシュボードへ
            </Link>
            <button
              onClick={() => setOpenJoin(true)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            >
              既存グループに参加
            </button>
            <button
              onClick={async () => {
                await signOut(auth);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            >
              ログアウト
            </button>
          </div>
        </div>

        <p style={{ marginTop: 8, opacity: 0.7 }}>
          ユーザー: <strong>{user.displayName ?? "No Name"}</strong>（
          {user.email ?? "-"}）
        </p>

        <hr style={{ margin: "16px 0 12px" }} />

        <h3 style={{ margin: "0 0 8px" }}>参加済みグループ一覧</h3>
        {loading ? (
          <div>Loading...</div>
        ) : myGroups.length === 0 ? (
          <div style={{ opacity: 0.7 }}>参加済みグループはありません。</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {myGroups.map((g) => {
              const gidStr = pad6(g.group_id);
              return (
                <div
                  key={gidStr}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{g.group_name}</div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>ID: {pad6(g.group_id)}</span>
                      <span>最終更新: {formatTs(g.last_updated)}</span>
                      <span>作成者: {creatorNameOf(g)}</span>
                    </div>
                  </div>
                  <Link
                    to={`/player/group/${gidStr}`}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                    }}
                  >
                    このグループへ
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 既存グループ参加モーダル（player） */}
      <Modal
        open={openJoin}
        onClose={() => {
          if (!joining) setOpenJoin(false);
        }}
      >
        <div>
          <h3 style={{ marginTop: 0 }}>既存グループへの参加（Player）</h3>
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>
            グループID
          </label>
          <input
            value={joinGroupId}
            onChange={(e) =>
              setJoinGroupId(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="整数ID (6桁)"
            inputMode="numeric"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
          <label
            style={{ display: "block", fontSize: 14, margin: "12px 0 6px" }}
          >
            Player パスワード
          </label>
          <input
            value={joinPlayerPw}
            onChange={(e) =>
              setJoinPlayerPw(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="数字 (6桁)"
            inputMode="numeric"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
            }}
          />
          <label
            style={{ display: "block", fontSize: 14, margin: "12px 0 6px" }}
          >
            上位ランキンググラフで表示する自分の色
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="color"
              value={normalizeColor(joinRankingColor) || "#2563EB"}
              onChange={(e) =>
                setJoinRankingColor(normalizeColor(e.target.value))
              }
              style={{
                width: 48,
                height: 42,
                padding: 4,
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            />
            <input
              value={joinRankingColor}
              onChange={(e) => setJoinRankingColor(e.target.value.toUpperCase())}
              placeholder="#2563EB"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
            {normalizeColor(joinRankingColor) && (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: normalizeColor(joinRankingColor),
                  border: "1px solid #ddd",
                }}
              />
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>
            必須です。他のプレイヤーと完全に同じRGBは使用できません。
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={joinGroupAsPlayer}
              disabled={joining}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            >
              {joining ? "参加中..." : "参加する"}
            </button>
            <button
              onClick={() => {
                if (!joining) setOpenJoin(false);
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      </Modal>
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            maxWidth: "92vw",
            padding: "10px 14px",
            borderRadius: 8,
            background: "#111827",
            color: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            zIndex: 1200,
            fontSize: 14,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
