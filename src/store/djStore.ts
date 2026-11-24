import { create } from "zustand";
import { analyzeYouTubeTempo, getPitchForBpmSync } from "../bpm/bpmAnalyzer";
import { createInitialEffects, createInitialSamplerPads, createInitialSoundFx } from "../data/djEffects";
import { extractYouTubeVideoId, fetchYouTubeTrackMeta } from "../services/youtubeService";
import type {
  AiSuggestion,
  DeckId,
  DeckState,
  EffectId,
  EffectState,
  FadeCurve,
  MixerState,
  PlaylistTrack,
  RecordingState,
  SamplerPadState,
  SoundFxState
} from "../types/dj";

export const deckSlots: DeckId[] = ["A", "B", "C", "D", "E"];

const makeHotCues = () =>
  Array.from({ length: 8 }, (_, index) => ({
    index: index + 1,
    label: `${index + 1}`,
    time: 0,
    active: false
  }));

const createDeck = (id: DeckId): DeckState => ({
  loadId: 0,
  autoPlay: false,
  source: "local",
  localFile: null,
  id,
  url: "",
  videoId: null,
  title: `Deck ${id}`,
  status: "idle",
  error: null,
  isPlaying: false,
  bpm: id === "A" ? 124 : id === "B" ? 126 : 120 + deckSlots.indexOf(id) * 2,
  targetBpm: null,
  pitch: 0,
  volume: 86,
  gain: 72,
  eq: { high: 0, mid: 0, low: 0 },
  cueEnabled: false,
  headphoneCue: false,
  loop: { enabled: false, bars: 4 },
  hotCues: makeHotCues(),
  beatGrid: [],
  downbeats: [],
  duration: 0,
  currentTime: 0,
  waveformZoom: 1
});

const initialMixer: MixerState = {
  crossfader: 50,
  fadeCurve: "smooth",
  masterVolume: 82,
  channelVolumeA: 88,
  channelVolumeB: 88,
  gainA: 70,
  gainB: 70,
  highA: 0,
  highB: 0,
  midA: 0,
  midB: 0,
  lowA: 0,
  lowB: 0,
  vuA: 18,
  vuB: 20,
  masterMeter: 22
};

interface DjStore {
  decks: Record<DeckId, DeckState>;
  mixer: MixerState;
  effects: Record<string, EffectState>;
  soundFx: Record<string, SoundFxState>;
  samplerPads: SamplerPadState[];
  playlist: PlaylistTrack[];
  recording: RecordingState;
  aiSuggestions: AiSuggestion[];
  performanceMode: boolean;
  activeDeckId: DeckId;
  visibleDeckIds: DeckId[];
  setActiveDeck: (deckId: DeckId) => void;
  addDeck: () => void;
  updateDeck: (deckId: DeckId, patch: Partial<DeckState>) => void;
  loadYouTubeTrack: (deckId: DeckId, url: string, autoPlay?: boolean) => Promise<void>;
  setPlayback: (deckId: DeckId, isPlaying: boolean) => void;
  setDeckPosition: (deckId: DeckId, currentTime: number, duration?: number) => void;
  updateMixer: (patch: Partial<MixerState>) => void;
  setFadeCurve: (curve: FadeCurve) => void;
  updateEffect: (effectId: EffectId, patch: Partial<EffectState>) => void;
  updateSoundFx: (fxId: string, patch: Partial<SoundFxState>) => void;
  updateSamplerPad: (padId: number, patch: Partial<SamplerPadState>) => void;
  addPlaylistTrack: (track: PlaylistTrack) => void;
  removePlaylistTrack: (trackId: string) => void;
  queueTrack: (trackId: string, deckId: DeckId) => void;
  reorderPlaylist: (trackId: string, direction: -1 | 1) => void;
  setPlaylist: (tracks: PlaylistTrack[]) => void;
  setRecording: (patch: Partial<RecordingState>) => void;
  syncDeck: (sourceDeckId: DeckId, targetDeckId: DeckId) => void;
  toggleHotCue: (deckId: DeckId, cueIndex: number) => void;
  regenerateAiSuggestions: () => void;
  setPerformanceMode: (enabled: boolean) => void;
}

const buildAiSuggestions = (decks: Record<DeckId, DeckState>, mixer: MixerState): AiSuggestion[] => {
  const bpmGap = Math.abs(decks.A.bpm - decks.B.bpm);
  const transitionBar = decks.A.downbeats[8] ?? 32;
  const curveLabel = mixer.fadeCurve === "scratch" ? "cut-ready" : "blend-ready";

  return [
    {
      id: "next-song",
      label: "Best next song",
      value: bpmGap <= 4 ? "Deck B fits the current tempo lane" : "Queue a bridge track within 4 BPM",
      confidence: bpmGap <= 4 ? 92 : 72
    },
    {
      id: "transition",
      label: "Best transition timing",
      value: `Mix on the downbeat near ${Math.round(transitionBar)}s`,
      confidence: 88
    },
    {
      id: "effects",
      label: "Recommended effects",
      value: mixer.crossfader < 35 || mixer.crossfader > 65 ? "Echo out with filter sweep" : "Beat repeat into smooth fade",
      confidence: 84
    },
    {
      id: "automix",
      label: "Auto mixing mode",
      value: `${curveLabel}, sync ${bpmGap.toFixed(1)} BPM gap`,
      confidence: 80
    }
  ];
};

export const useDjStore = create<DjStore>((set, get) => ({
  decks: {
    A: createDeck("A"),
    B: createDeck("B"),
    C: createDeck("C"),
    D: createDeck("D"),
    E: createDeck("E")
  },
  mixer: initialMixer,
  effects: createInitialEffects(),
  soundFx: createInitialSoundFx(),
  samplerPads: createInitialSamplerPads(),
  playlist: [],
  recording: {
    status: "idle",
    startedAt: null,
    durationSeconds: 0,
    format: "wav",
    downloadUrl: null
  },
  aiSuggestions: buildAiSuggestions(
    {
      A: createDeck("A"),
      B: createDeck("B"),
      C: createDeck("C"),
      D: createDeck("D"),
      E: createDeck("E")
    },
    initialMixer
  ),
  performanceMode: false,
  activeDeckId: "A",
  visibleDeckIds: ["A", "B"],

  setActiveDeck: (deckId) => set({ activeDeckId: deckId }),

  addDeck: () =>
    set((state) => {
      const nextDeckId = deckSlots.find((deckId) => !state.visibleDeckIds.includes(deckId));
      if (!nextDeckId) {
        return state;
      }

      return {
        visibleDeckIds: [...state.visibleDeckIds, nextDeckId],
        activeDeckId: nextDeckId
      };
    }),

  updateDeck: (deckId, patch) =>
    set((state) => ({
      decks: {
        ...state.decks,
        [deckId]: {
          ...state.decks[deckId],
          ...patch
        }
      }
    })),

  loadYouTubeTrack: async (deckId, url, autoPlay = false) => {
    const loadId = get().decks[deckId].loadId + 1;
    const videoId=extractYouTubeVideoId(url);
    if(!videoId) {get().updateDeck(deckId,{error:"Enter a valid YouTube URL."});return;}
    get().updateDeck(deckId, { loadId, autoPlay, source:"youtube", url, localFile:null, videoId, title:"YouTube "+videoId, status:"loading", error:null, isPlaying:false, currentTime:0, duration:0, beatGrid:[], downbeats:[] });

    try {
      const meta = await fetchYouTubeTrackMeta(url);
      if (get().decks[deckId].loadId !== loadId) return;
      const analysis = analyzeYouTubeTempo(meta.videoId, meta.title);

      get().updateDeck(deckId, {
        url,
        videoId: meta.videoId,
        title: meta.title,
        bpm: analysis.bpm,
        targetBpm: analysis.bpm,
        beatGrid: analysis.beatGrid,
        downbeats: analysis.downbeats
      });

      get().regenerateAiSuggestions();
    } catch (error) {
      if (get().decks[deckId].loadId !== loadId) return;
      get().updateDeck(deckId, {
        status: "error",
        error: error instanceof Error ? error.message : "Unable to load YouTube track."
      });
    }
  },

  setPlayback: (deckId, isPlaying) => get().updateDeck(deckId, { isPlaying }),

  setDeckPosition: (deckId, currentTime, duration) =>
    get().updateDeck(deckId, {
      currentTime,
      duration: duration ?? get().decks[deckId].duration
    }),

  updateMixer: (patch) =>
    set((state) => ({
      mixer: {
        ...state.mixer,
        ...patch
      }
    })),

  setFadeCurve: (curve) => get().updateMixer({ fadeCurve: curve }),

  updateEffect: (effectId, patch) =>
    set((state) => ({
      effects: {
        ...state.effects,
        [effectId]: {
          ...state.effects[effectId],
          ...patch
        }
      }
    })),

  updateSoundFx: (fxId, patch) =>
    set((state) => ({
      soundFx: {
        ...state.soundFx,
        [fxId]: {
          ...state.soundFx[fxId],
          ...patch
        }
      }
    })),

  updateSamplerPad: (padId, patch) =>
    set((state) => ({
      samplerPads: state.samplerPads.map((pad) => (pad.id === padId ? { ...pad, ...patch } : pad))
    })),

  addPlaylistTrack: (track) =>
    set((state) => ({
      playlist: [track, ...state.playlist]
    })),

  removePlaylistTrack: (trackId) =>
    set((state) => ({
      playlist: state.playlist.filter((track) => track.id !== trackId)
    })),

  queueTrack: (trackId, deckId) =>
    set((state) => ({
      playlist: state.playlist.map((track) =>
        track.id === trackId ? { ...track, queuedDeck: deckId } : { ...track, queuedDeck: null }
      )
    })),

  reorderPlaylist: (trackId, direction) =>
    set((state) => {
      const playlist = [...state.playlist];
      const index = playlist.findIndex((track) => track.id === trackId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= playlist.length) {
        return { playlist };
      }

      const [track] = playlist.splice(index, 1);
      playlist.splice(nextIndex, 0, track);
      return { playlist };
    }),

  setPlaylist: (tracks) => set({ playlist: tracks }),

  setRecording: (patch) =>
    set((state) => ({
      recording: {
        ...state.recording,
        ...patch
      }
    })),

  syncDeck: (sourceDeckId, targetDeckId) => {
    const source = get().decks[sourceDeckId];
    const target = get().decks[targetDeckId];
    const pitch = getPitchForBpmSync(source.bpm, target.bpm);
    get().updateDeck(sourceDeckId, {
      pitch,
      targetBpm: target.bpm,
      currentTime: target.currentTime
    });
    get().regenerateAiSuggestions();
  },

  toggleHotCue: (deckId, cueIndex) =>
    set((state) => {
      const deck = state.decks[deckId];
      return {
        decks: {
          ...state.decks,
          [deckId]: {
            ...deck,
            hotCues: deck.hotCues.map((cue) =>
              cue.index === cueIndex
                ? {
                    ...cue,
                    active: !cue.active,
                    time: cue.active ? 0 : deck.currentTime
                  }
                : cue
            )
          }
        }
      };
    }),

  regenerateAiSuggestions: () =>
    set((state) => ({
      aiSuggestions: buildAiSuggestions(state.decks, state.mixer)
    })),

  setPerformanceMode: (enabled) => set({ performanceMode: enabled })
}));
