import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useStore } from "../game/store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => useStore.getState().setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-surface px-5 py-2 shadow-card text-sm"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
