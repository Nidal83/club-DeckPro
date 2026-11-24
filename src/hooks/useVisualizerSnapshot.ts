import { useEffect, useState } from "react";
import { readStoredVisualizerSnapshot, VISUALIZER_CHANNEL, VISUALIZER_STORAGE_KEY } from "../services/visualizerBridge";
import type { VisualizerSnapshot } from "../types/visualizer";

export function useVisualizerSnapshot() {
  const [snapshot, setSnapshot] = useState<VisualizerSnapshot>(() => readStoredVisualizerSnapshot());

  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(VISUALIZER_CHANNEL) : null;

    channel?.addEventListener("message", (event: MessageEvent<VisualizerSnapshot>) => {
      setSnapshot(event.data);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === VISUALIZER_STORAGE_KEY) {
        setSnapshot(readStoredVisualizerSnapshot());
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return snapshot;
}
