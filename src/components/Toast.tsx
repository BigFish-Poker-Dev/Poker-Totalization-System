type Props = {
  message: string;
};

export default function Toast({ message }: Props) {
  if (!message) return null;

  return (
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
      {message}
    </div>
  );
}
