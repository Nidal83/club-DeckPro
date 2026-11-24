import WaveSurfer from "wavesurfer.js";

export type WaveformBar = {
  height: number;
  hue: "low" | "mid" | "high";
  beat: boolean;
  downbeat: boolean;
};

const peakCache = new WeakMap<File, Promise<WaveformBar[]>>();
export function fileWaveform(file: File) {
  let task = peakCache.get(file);
  if (!task) {
    task = (async () => {
      const decoder = new OfflineAudioContext(1, 1, 11025);
      const buffer = await decoder.decodeAudioData(await file.arrayBuffer());
      const samples = buffer.getChannelData(0);
      const count = 640;
      return Array.from({length:count}, (_,i) => {
        const start=Math.floor(i*samples.length/count), end=Math.floor((i+1)*samples.length/count);
        let peak=0, crossings=0;
        for(let j=start;j<end;j++) {
          peak=Math.max(peak,Math.abs(samples[j]));
          if(j>start && (samples[j-1]<0)!==(samples[j]<0)) crossings++;
        }
        const rate=crossings/Math.max(1,end-start);
        return {height:Math.max(0.015,Math.sqrt(peak)), hue:rate<0.045?"low":rate<0.22?"mid":"high",beat:false,downbeat:false} satisfies WaveformBar;
      });
    })();
    peakCache.set(file,task);
  }
  return task;
}

const stableSeed = (value: string) =>
  value.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 7), 0);

export const createSyntheticWaveform = (seedValue: string, bpm: number, bars = 160): WaveformBar[] => {
  const seed = stableSeed(`${seedValue}:${bpm}`);

  return Array.from({ length: bars }, (_, index) => {
    const wave = Math.sin((index + seed) * 0.23) * 0.5 + Math.sin((index + seed) * 0.071) * 0.32;
    const transient = index % 16 === 0 ? 0.38 : index % 4 === 0 ? 0.18 : 0;
    const normalized = Math.min(1, Math.max(0.12, Math.abs(wave) + transient));
    const hue = index % 7 === 0 ? "high" : index % 5 === 0 ? "low" : "mid";

    return {
      height: Number(normalized.toFixed(3)),
      hue,
      beat: index % 4 === 0,
      downbeat: index % 16 === 0
    };
  });
};

export const createWaveSurferInstance = (container: HTMLElement, media?: HTMLMediaElement) =>
  WaveSurfer.create({
    container,
    media,
    waveColor: "#38bdf8",
    progressColor: "#f59e0b",
    cursorColor: "#ffffff",
    barWidth: 2,
    barGap: 2,
    barRadius: 2,
    height: 96,
    normalize: true
  });
