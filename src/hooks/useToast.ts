import { useCallback, useRef, useState } from "react";

export function useToast(durationMs = 3200) {
  const [toast, setToast] = useState("");
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setToast((current) => (current === message ? "" : current));
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  return { toast, showToast };
}
