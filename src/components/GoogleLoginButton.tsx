// src/components/GoogleLoginButton.tsx
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import type { UserCredential } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";

type Props = {
  label: string;
  redirectTo?: string; // 後方互換: 未指定なら /player へ
  onSuccess?: (cred: UserCredential) => void | Promise<void>;
};

export default function GoogleLoginButton({
  label,
  redirectTo = "/player",
  onSuccess,
}: Props) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setBusy(true);
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);

      if (onSuccess) {
        await onSuccess(cred);
      } else {
        navigate(redirectTo);
      }
    } catch (e) {
      console.error(e);
      alert("ログインに失敗しました。コンソールを確認してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={busy}
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid #ddd",
        fontSize: 16,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#fff",
        width: "100%",
        justifyContent: "center",
      }}
      aria-label={label}
    >
      <span style={{ width: 18, height: 18, display: "inline-block" }}>
        <FcGoogle size={18} />
      </span>
      {busy ? "ログイン中..." : label}
    </button>
  );
}
