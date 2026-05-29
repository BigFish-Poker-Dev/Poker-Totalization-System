// src/pages/LoginPage.tsx
import { useState } from "react";
import GoogleLoginButton from "../components/GoogleLoginButton";
import Modal from "../components/Modal";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const releaseNotes = [
  {
    date: "2026/05/29",
    title: "収支報告で稼働時間と時給に対応",
    items: [
      "Playerの収支報告で、開始時刻と終了時刻を任意で登録できるようになりました。",
      "稼働時間を登録した収支をもとに、累計収支の横へ時給を表示するようになりました。",
      "開始時刻・終了時刻は、Playerのデータベース表示、Adminの収支一覧、更新履歴でも確認できます。",
    ],
  },
  {
    date: "2026/05/27",
    title: "グループ設定画面と集計状態表示を改善",
    items: [
      "Adminのグループ設定画面を、閲覧専用表示＋編集モーダル形式に刷新しました。",
      "Player/Admin のグループページで、OnGoing / Archive の状態が確認できるようになりました。",
      "Archive のグループでは、Player 画面の収支報告を非表示にし、収支確認を初期表示に変更しました。",
    ],
  },
  {
    date: "2026/05/27",
    title: "Player画面の収支確認を見やすく調整",
    items: [
      "収支確認の表示順を グラフ / カレンダー / データベース に変更しました。",
      "収支確認を開いたときの初期表示をグラフに変更しました。",
    ],
  },
  {
    date: "2026/04/15",
    title: "収支の単位切り替えに対応",
    items: [
      "グループごとにBB数・点数のどちらで報告するかを選べるようになりました。",
      "BB数で記録された過去データは、ステークスを使って点数に換算されます。",
    ],
  },
  {
    date: "2026/04/15",
    title: "ランキング推移グラフを追加",
    items: [
      "プレイヤー画面で上位ランキングの推移を確認できるようになりました。",
      "Admin画面では全プレイヤーのランキング推移を確認できます。",
    ],
  },
  {
    date: "2026/04/15",
    title: "収支推移グラフを追加",
    items: ["プレイヤー画面で収支の推移をグラフで確認できるようになりました。"],
  },
];

export default function LoginPage() {
  const [openRegister, setOpenRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [showPastReleaseNotes, setShowPastReleaseNotes] = useState(false);
  const navigate = useNavigate();

  const latestReleaseDate = releaseNotes[0]?.date ?? "";
  const latestReleaseNotes = releaseNotes.filter(
    (note) => note.date === latestReleaseDate,
  );
  const pastReleaseNotes = releaseNotes.filter(
    (note) => note.date !== latestReleaseDate,
  );

  // Google ログイン成功後：/users/{uid} の有無で分岐
  const handleLoginSuccess = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const uid = user.uid;
    const email = user.email ?? "";

    const uref = doc(db, "users", uid);
    const usnap = await getDoc(uref);

    if (usnap.exists()) {
      // 既に登録済み → Player ダッシュボードへ
      navigate("/player");
    } else {
      // 初回ログイン → その場でユーザー登録（表示名を決める）
      setPendingUid(uid);
      setPendingEmail(email);
      setDisplayName("");
      setOpenRegister(true);
    }
  };

  const submitRegister = async () => {
    const name = displayName.trim();
    if (!name) {
      alert("表示名を入力してください");
      return;
    }
    if (!pendingUid) return;

    try {
      setRegistering(true);
      await setDoc(doc(db, "users", pendingUid), {
        uid: pendingUid,
        email: pendingEmail ?? "",
        display_name: name,
        created_at: serverTimestamp(),
      });
      setOpenRegister(false);
      navigate("/player");
    } catch (e) {
      console.error(e);
      alert("ユーザー登録に失敗しました。コンソールを確認してください。");
    } finally {
      setRegistering(false);
    }
  };

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
          width: 500,
          maxWidth: "92vw",
          padding: 24,
          borderRadius: 16,
          boxShadow: "0 10px 28px rgba(0,0,0,.08)",
          background: "#fff",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: "0 0 8px" }}>Poker Totalization System</h1>

        <div style={{ height: 24 }} />

        {/* ログインボタンは1つだけ */}
        <GoogleLoginButton
          label="Google ログイン"
          // 成功後の遷移は onSuccess 内で実施（初回登録/既存で分岐）
          onSuccess={handleLoginSuccess}
        />

        <section
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1px solid #eee",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>リリースノート</h2>
            <span style={{ fontSize: 12, color: "#777", whiteSpace: "nowrap" }}>
              最新情報
            </span>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {latestReleaseNotes.map((note) => (
              <article key={`${note.date}-${note.title}`}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <time style={{ fontSize: 12, color: "#777" }}>
                    {note.date}
                  </time>
                  <h3 style={{ margin: 0, fontSize: 14 }}>{note.title}</h3>
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: "#555",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}
                >
                  {note.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}

            {pastReleaseNotes.length > 0 && (
              <div style={{ display: "grid", gap: 12 }}>
                <button
                  onClick={() => setShowPastReleaseNotes((prev) => !prev)}
                  style={{
                    justifySelf: "start",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {showPastReleaseNotes
                    ? "過去のリリースノートを閉じる"
                    : "過去のリリースノートを表示"}
                </button>

                {showPastReleaseNotes && (
                  <div style={{ display: "grid", gap: 16 }}>
                    {pastReleaseNotes.map((note) => (
                      <article key={`${note.date}-${note.title}`}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "baseline",
                            flexWrap: "wrap",
                            marginBottom: 6,
                          }}
                        >
                          <time style={{ fontSize: 12, color: "#777" }}>
                            {note.date}
                          </time>
                          <h3 style={{ margin: 0, fontSize: 14 }}>
                            {note.title}
                          </h3>
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            color: "#555",
                            fontSize: 13,
                            lineHeight: 1.7,
                          }}
                        >
                          {note.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 初回ユーザー登録モーダル */}
      <Modal
        open={openRegister}
        onClose={() => {
          if (!registering) setOpenRegister(false);
        }}
      >
        <h3 style={{ marginTop: 0 }}>初回ユーザー登録</h3>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          収支ランキング等に表示される表示名を設定してください。
          <br />
          <strong style={{ color: "red" }}>
            ※この表示名は後から変更できません。
          </strong>
        </p>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={submitRegister}
            disabled={registering}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            {registering ? "登録中..." : "登録して続行"}
          </button>
          <button
            onClick={() => {
              if (!registering) setOpenRegister(false);
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
      </Modal>
    </div>
  );
}
