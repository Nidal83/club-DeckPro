import { Download, Pause, Play, Square } from "lucide-react";
import { audioEngine } from "../../audio/audioEngine";
import { recordingSystem } from "../../recording/recordingSystem";
import { useDjStore } from "../../store/djStore";
import { ControlButton } from "./ControlButton";

export function RecordingPanel() {
  const recording = useDjStore((state) => state.recording);
  const setRecording = useDjStore((state) => state.setRecording);

  const startRecording = async () => {
    await audioEngine.initialize();
    const stream = audioEngine.getRecordingStream();
    if (!stream) {
      return;
    }

    recordingSystem.start(stream, recording.format, (downloadUrl) => {
      setRecording({
        status: "ready",
        downloadUrl,
        durationSeconds: Math.max(1, Math.round((Date.now() - Date.parse(recording.startedAt ?? new Date().toISOString())) / 1000))
      });
    });

    setRecording({
      status: "recording",
      startedAt: new Date().toISOString(),
      downloadUrl: null,
      durationSeconds: 0
    });
  };

  const pauseRecording = () => {
    if (recording.status === "recording") {
      recordingSystem.pause();
      setRecording({ status: "paused" });
      return;
    }

    recordingSystem.resume();
    setRecording({ status: "recording" });
  };

  const stopRecording = () => {
    recordingSystem.stop();
    setRecording({ status: "ready" });
  };

  return (
    <section className="dj-panel grid gap-4 p-4">
      <div>
        <p className="text-xs font-black uppercase text-amber-300">Recorder</p>
        <h2 className="text-xl font-black text-white">Live Session</h2>
      </div>

      <div className="grid gap-3 rounded-md border border-white/10 bg-black/35 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase text-zinc-400">Status</span>
          <span className="text-sm font-black uppercase text-amber-200">{recording.status}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-hint="Use a .wav filename." onClick={() => setRecording({ format: "wav" })}
            className={`rounded-md border px-3 py-2 text-sm font-black uppercase ${recording.format === "wav" ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-400"}`}
          >
            WAV
          </button>
          <button
            type="button"
            data-hint="Use an .mp3 filename." onClick={() => setRecording({ format: "mp3" })}
            className={`rounded-md border px-3 py-2 text-sm font-black uppercase ${recording.format === "mp3" ? "border-sky-300 bg-sky-300/15 text-sky-100" : "border-white/10 text-zinc-400"}`}
          >
            MP3
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ControlButton disabled={recording.status==="recording"||recording.status==="paused"} data-hint="Record the mix." label="Start recording" tone="blue" active={recording.status === "recording"} onClick={() => void startRecording()}>
          <Play size={17} />
        </ControlButton>
        <ControlButton data-hint={recording.status==="paused"?"Tap to resume recording.":"Tap to pause recording."} label="Pause recording" onClick={pauseRecording} disabled={recording.status === "idle" || recording.status === "ready"}>
          <Pause size={17} />
        </ControlButton>
        <ControlButton data-hint="Finish the recording." label="Stop recording" tone="danger" onClick={stopRecording} disabled={recording.status === "idle"}>
          <Square size={17} />
        </ControlButton>
        <a
          data-hint="Save the recorded file." aria-label="Download recording"
          title="Download recording"
          href={recording.downloadUrl ?? undefined}
          download={`dj-session.${recording.format}`}
          className={`inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-bold transition ${
            recording.downloadUrl
              ? "border-amber-400/35 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
              : "pointer-events-none border-white/10 bg-white/[0.04] text-zinc-700"
          }`}
        >
          <Download size={17} />
        </a>
      </div>
    </section>
  );
}
