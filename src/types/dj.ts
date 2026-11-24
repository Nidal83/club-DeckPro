export type DeckId = "A" | "B" | "C" | "D" | "E";

export type DeckStatus = "idle" | "loading" | "ready" | "error";

export type FadeCurve = "linear" | "smooth" | "sharp" | "scratch";

export type EffectCategory = "Basic" | "Club" | "Performance" | "EDM";

export type EffectId =
  | "echo"
  | "delay"
  | "reverb"
  | "flanger"
  | "phaser"
  | "chorus"
  | "filter-sweep"
  | "white-noise"
  | "noise-rise"
  | "downlifter"
  | "impact"
  | "build-up"
  | "vinyl-brake"
  | "vinyl-start"
  | "backspin"
  | "stutter"
  | "beat-repeat"
  | "roll"
  | "bass-drop"
  | "reverse-crash"
  | "energy-build"
  | "laser-sweep"
  | "festival-drop";

export interface HotCue {
  index: number;
  label: string;
  time: number;
  active: boolean;
}

export interface LoopState {
  enabled: boolean;
  bars: number;
}

export interface EqState {
  high: number;
  mid: number;
  low: number;
}

export interface DeckState {
  loadId: number;
  autoPlay: boolean;
  source: "local" | "youtube";
  localFile: File | null;
  id: DeckId;
  url: string;
  videoId: string | null;
  title: string;
  status: DeckStatus;
  error: string | null;
  isPlaying: boolean;
  bpm: number;
  targetBpm: number | null;
  pitch: number;
  volume: number;
  gain: number;
  eq: EqState;
  cueEnabled: boolean;
  headphoneCue: boolean;
  loop: LoopState;
  hotCues: HotCue[];
  beatGrid: number[];
  downbeats: number[];
  duration: number;
  currentTime: number;
  waveformZoom: number;
}

export interface MixerState {
  crossfader: number;
  fadeCurve: FadeCurve;
  masterVolume: number;
  channelVolumeA: number;
  channelVolumeB: number;
  gainA: number;
  gainB: number;
  highA: number;
  highB: number;
  midA: number;
  midB: number;
  lowA: number;
  lowB: number;
  vuA: number;
  vuB: number;
  masterMeter: number;
}

export interface DjEffectDefinition {
  id: EffectId;
  label: string;
  category: EffectCategory;
  accent: "amber" | "blue" | "cyan" | "pink";
}

export interface EffectState {
  id: EffectId;
  enabled: boolean;
  dryWet: number;
  amount: number;
}

export interface SoundFxDefinition {
  id: string;
  label: string;
}

export interface SoundFxState {
  id: string;
  volume: number;
  assignA: boolean;
  assignB: boolean;
  assignMaster: boolean;
  isPlaying: boolean;
}

export interface SamplerPadState {
  id: number;
  label: string;
  fileName: string | null;
  objectUrl: string | null;
  volume: number;
  isPlaying: boolean;
}

export interface PlaylistTrack {
  id: string;
  url: string;
  videoId: string | null;
  title: string;
  bpm: number;
  queuedDeck: DeckId | null;
  createdAt: string;
}

export interface RecordingState {
  status: "idle" | "recording" | "paused" | "ready";
  startedAt: string | null;
  durationSeconds: number;
  format: "wav" | "mp3";
  downloadUrl: string | null;
}

export interface AiSuggestion {
  id: string;
  label: string;
  value: string;
  confidence: number;
}

export interface BpmAnalysis {
  bpm: number;
  beatGrid: number[];
  downbeats: number[];
  tempoLabel: string;
}
