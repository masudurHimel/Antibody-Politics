import { useEffect, useRef } from "react";

/** In-page confirmation (never window.confirm). Esc or "Keep playing" cancels. */
export function ConfirmDialog({
  title,
  text,
  confirmLabel = "Switch",
  cancelLabel = "Keep playing",
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="win" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmText">
      <div className="box">
        <h2 id="confirmTitle">{title}</h2>
        <p id="confirmText">{text}</p>
        <div className="confirm-btns">
          <button type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className="ghost" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
