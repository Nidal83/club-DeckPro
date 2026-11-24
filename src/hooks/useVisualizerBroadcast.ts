import { useEffect } from "react";
import { deckSlots, useDjStore } from "../store/djStore";
import { VISUALIZER_CHANNEL, VISUALIZER_STORAGE_KEY } from "../services/visualizerBridge";
import type { VisualizerSnapshot } from "../types/visualizer";

export function useVisualizerBroadcast() {
  useEffect(() => {
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(VISUALIZER_CHANNEL) : null;
    let lastStorageWrite = 0;

    const publish = () => {
      const { decks, mixer, visibleDeckIds } = useDjStore.getState();
      const snapshot: VisualizerSnapshot = {
        updatedAt: Date.now(),
        visibleDeckIds,
        decks: Object.fromEntries(
          deckSlots.map((deckId) => {
            const deck = decks[deckId];
            return [
              deckId,
              {
                id: deckId,
                title: deck.title,
                bpm: deck.targetBpm ?? deck.bpm,
                isPlaying: deck.isPlaying,
                status: deck.status,
                volume: deck.volume,
                currentTime: deck.currentTime,
                duration: deck.duration
              }
            ];
          })
        ) as VisualizerSnapshot["decks"],
        mixer: {
          crossfader: mixer.crossfader,
          vuA: mixer.vuA,
          vuB: mixer.vuB,
          masterMeter: mixer.masterMeter
        }
      };

      channel?.postMessage(snapshot);

      if (Date.now() - lastStorageWrite > 500) {
        localStorage.setItem(VISUALIZER_STORAGE_KEY, JSON.stringify(snapshot));
        lastStorageWrite = Date.now();
      }
    };

    publish();
    const timer = window.setInterval(publish, 120);

    return () => {
      window.clearInterval(timer);
      channel?.close();
    };
  }, []);
}
