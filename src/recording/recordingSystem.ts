import type { RecordingState } from "../types/dj";

class RecordingSystem {
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private downloadUrl: string | null = null;

  canRecord() {
    return typeof MediaRecorder !== "undefined";
  }

  start(stream: MediaStream, format: RecordingState["format"], onReady: (url: string) => void) {
    if (!this.canRecord()) {
      throw new Error("MediaRecorder is not supported in this browser.");
    }

    this.revoke();
    this.chunks = [];
    const mimeType = format === "wav" ? "audio/webm;codecs=opus" : "audio/webm;codecs=opus";
    this.recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined);

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || "audio/webm" });
      this.downloadUrl = URL.createObjectURL(blob);
      onReady(this.downloadUrl);
    };

    this.recorder.start(250);
  }

  pause() {
    if (this.recorder?.state === "recording") {
      this.recorder.pause();
    }
  }

  resume() {
    if (this.recorder?.state === "paused") {
      this.recorder.resume();
    }
  }

  stop() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
  }

  revoke() {
    if (this.downloadUrl) {
      URL.revokeObjectURL(this.downloadUrl);
      this.downloadUrl = null;
    }
  }
}

export const recordingSystem = new RecordingSystem();
