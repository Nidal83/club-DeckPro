import type { DeckId } from "../types/dj";
import type { VisualizerSnapshot } from "../types/visualizer";

export const VISUALIZER_CHANNEL = "nidal-clubdeck-visualizer";
export const VISUALIZER_STORAGE_KEY = "nidal-clubdeck-visualizer-state";

export const createFallbackVisualizerSnapshot = (): VisualizerSnapshot => ({
  updatedAt: Date.now(),
  visibleDeckIds: ["A", "B"],
  decks: {
    A: {
      id: "A",
      title: "Deck A",
      bpm: 124,
      isPlaying: false,
      status: "idle",
      volume: 86,
      currentTime: 0,
      duration: 0
    },
    B: {
      id: "B",
      title: "Deck B",
      bpm: 126,
      isPlaying: false,
      status: "idle",
      volume: 86,
      currentTime: 0,
      duration: 0
    },
    C: {
      id: "C",
      title: "Deck C",
      bpm: 124,
      isPlaying: false,
      status: "idle",
      volume: 86,
      currentTime: 0,
      duration: 0
    },
    D: {
      id: "D",
      title: "Deck D",
      bpm: 126,
      isPlaying: false,
      status: "idle",
      volume: 86,
      currentTime: 0,
      duration: 0
    },
    E: {
      id: "E",
      title: "Deck E",
      bpm: 128,
      isPlaying: false,
      status: "idle",
      volume: 86,
      currentTime: 0,
      duration: 0
    }
  },
  mixer: {
    crossfader: 50,
    vuA: 6,
    vuB: 6,
    masterMeter: 8
  }
});

export const getActiveDeckId = (snapshot: VisualizerSnapshot): DeckId => {
  const playingExtraDeck = snapshot.visibleDeckIds.find((deckId) => deckId !== "A" && deckId !== "B" && snapshot.decks[deckId]?.isPlaying);
  if (playingExtraDeck) {
    return playingExtraDeck;
  }

  if (snapshot.mixer.crossfader < 42) {
    return "A";
  }

  if (snapshot.mixer.crossfader > 58) {
    return "B";
  }

  return snapshot.mixer.vuA >= snapshot.mixer.vuB ? "A" : "B";
};

export const readStoredVisualizerSnapshot = () => {
  try {
    const stored = localStorage.getItem(VISUALIZER_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as VisualizerSnapshot) : createFallbackVisualizerSnapshot();
  } catch {
    return createFallbackVisualizerSnapshot();
  }
};
