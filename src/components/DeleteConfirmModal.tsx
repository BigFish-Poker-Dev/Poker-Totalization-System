import Modal from "./Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
};

export default function DeleteConfirmModal({
  open,
  onClose,
  onDelete,
  deleting,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} width={360}>
      <h3 style={{ marginTop: 0, color: "#d00" }}>削除の確認</h3>
      <p style={{ lineHeight: 1.6 }}>
        この収支データを削除しますか？
        <br />
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          ※ 履歴には「削除」として残ります
        </span>
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          キャンセル
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "#d00",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {deleting ? "削除中..." : "削除する"}
        </button>
      </div>
    </Modal>
  );
}
