import type { DeckId } from "../types/dj";

type PlayerState = -1 | 0 | 1 | 2 | 3 | 5;

interface YouTubeRawPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate?: (suggestedRate: number) => void;
  getPlaybackRate?: () => number;
  getAvailablePlaybackRates?: () => number[];
  getDuration: () => number;
  getCurrentTime: () => number;
  destroy: () => void;
}

interface YouTubeIframeApi {
  Player: new (
    elementId: HTMLElement,
    config: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: PlayerState }) => void;
        onError?: (event: { data: number }) => void;
        onAutoplayBlocked?: () => void;
      };
    }
  ) => YouTubeRawPlayer;
  PlayerState: {
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubeTrackMeta {
  videoId: string;
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
}

export interface YouTubeDeckPlayer {
  deckId: DeckId;
  play: () => void;
  pause: () => void;
  cue: () => void;
  stop: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getDuration: () => number;
  getCurrentTime: () => number;
  destroy: () => void;
}

let iframeApiPromise: Promise<YouTubeIframeApi> | null = null;

export const extractYouTubeVideoId = (url: string): string | null => {
  try {
    const input=url.trim();
    const parsed = new URL(/^https?:\/\//i.test(input)?input:"https://"+input);
    const host = parsed.hostname.replace(/^www\./, "");
    const id=(value:string|null|undefined)=>value && /^[-\w]{11}$/.test(value)?value:null;

    if (host === "youtu.be") {
      return id(parsed.pathname.split("/")[1]);
    }

    if (host==="youtube.com" || host.endsWith(".youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) {
        return id(parsed.searchParams.get("v"));
      }

      const embedMatch = parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
      return id(embedMatch?.[1]);
    }

    return null;
  } catch {
    return null;
  }
};

export const getYouTubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

export const loadYouTubeIframeApi = () => {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (iframeApiPromise) {
    return iframeApiPromise;
  }

  iframeApiPromise = new Promise<YouTubeIframeApi>((resolve, reject) => {
    const fail = () => {
      window.clearTimeout(timeout);
      document.querySelector("script[data-youtube-iframe-api]")?.remove();
      iframeApiPromise = null;
      reject(new Error("Cannot connect to the YouTube player. Check your connection and retry."));
    };
    const timeout = window.setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT) {
        window.clearTimeout(timeout);
        resolve(window.YT);
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-youtube-iframe-api]");
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.dataset.youtubeIframeApi = "true";
      script.onerror = fail;
      document.head.appendChild(script);
    }
  });

  return iframeApiPromise;
};

export const fetchYouTubeTrackMeta = async (url: string): Promise<YouTubeTrackMeta> => {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error("Enter a valid YouTube URL.");
  }

  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error("Metadata unavailable.");
    }

    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    return {
      videoId,
      title: data.title ?? `YouTube ${videoId}`,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url
    };
  } catch {
    return {
      videoId,
      title: `YouTube ${videoId}`
    };
  }
};

export const createYouTubeDeckPlayer = async (
  deckId: DeckId,
  mount: HTMLElement,
  videoId: string,
  callbacks: {
    onReady?: (duration: number) => void;
    onPlaying?: () => void;
    onPaused?: () => void;
    onEnded?: () => void;
    onError?: (event: { data: number }) => void;
    onAutoplayBlocked?: () => void;
  },
  signal: AbortSignal
): Promise<YouTubeDeckPlayer> => {
  const frame=document.createElement("iframe");
  const params=new URLSearchParams({enablejsapi:"1",origin:window.location.origin,playsinline:"1",controls:"1",autoplay:"0"});
  frame.src=`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
  frame.title=`YouTube player on Deck ${deckId}`;
  frame.allow="autoplay; encrypted-media; fullscreen";
  frame.referrerPolicy="strict-origin-when-cross-origin";
  mount.replaceWith(frame);
  const api = await loadYouTubeIframeApi();
  signal.throwIfAborted();

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      rawPlayer.destroy();
      reject(new Error("The YouTube player timed out. Check your connection and retry."));
    }, 15000);
    const rawPlayer = new api.Player(frame, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: {
        controls: 1,
        autoplay: 0,
        enablejsapi: 1,
        fs: 0,
        modestbranding: 1,
        origin: window.location.origin,
        playsinline: 1,
        rel: 0
      },
      events: {
        onReady: () => {
          window.clearTimeout(timeout);
          callbacks.onReady?.(rawPlayer.getDuration());
          resolve({
            deckId,
            play: () => rawPlayer.playVideo(),
            pause: () => rawPlayer.pauseVideo(),
            cue: () => rawPlayer.seekTo(0, true),
            stop: () => rawPlayer.stopVideo(),
            seekTo: (seconds: number) => rawPlayer.seekTo(seconds, true),
            setVolume: (volume: number) => rawPlayer.setVolume(Math.round(Math.min(100, Math.max(0, volume)))),
            setPlaybackRate: (rate: number) => {
              const availableRates = rawPlayer.getAvailablePlaybackRates?.() ?? [0.25, 0.5, 1, 1.25, 1.5, 2];
              const closestRate = availableRates.reduce((closest, option) =>
                Math.abs(option - rate) < Math.abs(closest - rate) ? option : closest
              );
              rawPlayer.setPlaybackRate?.(closestRate);
            },
            getPlaybackRate: () => rawPlayer.getPlaybackRate?.() ?? 1,
            getDuration: () => rawPlayer.getDuration(),
            getCurrentTime: () => rawPlayer.getCurrentTime(),
            destroy: () => rawPlayer.destroy()
          });
        },
        onStateChange: (event) => {
          if (event.data === api.PlayerState.PLAYING) {
            callbacks.onPlaying?.();
          }

          if (event.data === api.PlayerState.PAUSED || event.data === api.PlayerState.CUED) {
            callbacks.onPaused?.();
          }

          if (event.data === api.PlayerState.ENDED) {
            callbacks.onEnded?.();
          }
        },
        onError: (event) => {
          window.clearTimeout(timeout);
          callbacks.onError?.(event);
        },
        onAutoplayBlocked: callbacks.onAutoplayBlocked
      }
    });
    signal.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      rawPlayer.destroy();
      reject(signal.reason);
    }, { once: true });
  });
};

export function youtubeErrorMessage(code: number) {
  const reasons: Record<number, string> = {
    2: "Invalid video link.",
    5: "The embedded player could not play this video.",
    100: "This video was removed or is private.",
    101: "The owner disabled embedded playback. Choose another upload or open a local audio file.",
    150: "The owner disabled embedded playback. Choose another upload or open a local audio file.",
    153: "YouTube could not identify the app making this playback request."
  };
  return `YouTube (${code}): ${reasons[code] ?? "Playback failed. Retry or choose another source."}`;
}
