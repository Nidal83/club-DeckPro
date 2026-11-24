import { useCallback, useEffect, useMemo, useRef } from "react";
import { calculateCrossfadeGain } from "../audio/audioEngine";
import { audioEngine } from "../audio/audioEngine";
import { channels, LiveChannel, tapEffects, holdEffects } from "../audio/liveChannel";
import { useLive, usePreferences, changeLive, resetFx } from "../store/performance";
import { deckPlayerRegistry } from "../services/deckPlayerRegistry";
import { useDjStore } from "../store/djStore";
import type { DeckId } from "../types/dj";
import { createYouTubeDeckPlayer, youtubeErrorMessage, type YouTubeDeckPlayer } from "../services/youtubeService";

export function useYouTubeDeck(deckId: DeckId, elementId: string) {
  const deck = useDjStore((state) => state.decks[deckId]);
  const mixer = useDjStore((state) => state.mixer);
  const playerRef = useRef<YouTubeDeckPlayer | null>(null);
  const outputVolumeRef = useRef(0);
  const localPath=useRef<{audio:HTMLAudioElement;channel:LiveChannel|null}|null>(null);
  const switching=useDjStore(s=>s.decks.A.source==="youtube" || s.decks.B.source==="youtube");
  const blend=calculateCrossfadeGain(deckId,mixer.crossfader,mixer.fadeCurve);
  const lastBlend=useRef(blend);
  const mixGain=switching && deck.isPlaying ? lastBlend.current : switching ? 1 : blend;
  useEffect(()=>{lastBlend.current=mixGain;},[mixGain]);
  useEffect(()=>()=>{localPath.current?.channel?.destroy();channels.delete(deckId);localPath.current=null;},[deckId]);

  const outputVolume = useMemo(() => {
    const channelVolume = deckId === "A" ? mixer.channelVolumeA : deckId === "B" ? mixer.channelVolumeB : 100;
    const channelGain = deckId === "A" ? mixer.gainA : deckId === "B" ? mixer.gainB : 100;
    return Math.min(
      100,
      Math.max(0, deck.volume * (deck.gain / 100) * (channelGain / 100) * (channelVolume / 100) * (mixer.masterVolume / 100) * mixGain)
    );
  }, [
    deck.gain,
    mixGain,
    deck.volume,
    deckId,
    mixer.channelVolumeA,
    mixer.channelVolumeB,
    mixer.crossfader,
    mixer.fadeCurve,
    mixer.gainA,
    mixer.gainB,
    mixer.masterVolume
  ]);

  useEffect(() => {
    outputVolumeRef.current = outputVolume;
    playerRef.current?.setVolume(outputVolume);
  }, [outputVolume]);

  useEffect(() => {
    const host = document.getElementById(elementId);
    if (!host || (!deck.videoId && !deck.localFile)) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && useDjStore.getState().decks[deckId].loadId === deck.loadId;
    const fail = (error: string) => {
      if (current()) useDjStore.getState().updateDeck(deckId, { status: "error", error, isPlaying: false });
    };
    const playback = (playing: boolean) => {
      if (current()) useDjStore.getState().updateDeck(deckId,playing?{isPlaying:true,error:null}:{isPlaying:false});
    };
    const ready = (player: YouTubeDeckPlayer) => {
      if (!current()) return;
      playerRef.current = player;
      deckPlayerRegistry.register(deckId, player);
      player.setVolume(outputVolumeRef.current);
      player.setPlaybackRate(1 + useDjStore.getState().decks[deckId].pitch / 100);
      useDjStore.getState().updateDeck(deckId, { duration: player.getDuration(), status: "ready", error: null });
      if (deck.autoPlay) player.play();
    };
    let releaseFile: (() => void) | undefined;
    if (deck.localFile) {
      const path=localPath.current ??= {audio:new Audio(),channel:null};
      const audio = path.audio;
      const url = URL.createObjectURL(deck.localFile);
      let channel=path.channel;
      let cueRoute: string | undefined;
      let intent=0;
      const configure = () => {
        if (!channel) return;
        const d = useDjStore.getState().decks[deckId];
        const fx = useLive.getState()[deckId];
        const p = usePreferences.getState();
        channel.tone(fx.bypass ? 0 : fx.filter);
        channel.eq(d.eq.low,d.eq.mid,d.eq.high);
        const fav=fx.bypass?null:fx.favorite;
        const tap=tapEffects.find(name=>name===fav) ?? (fx.echo?p.slots[deckId][0]:null);
        const hold=holdEffects.find(name=>name===fav) ?? (fx.roll?p.slots[deckId][1]:null);
        const effect=useDjStore.getState().effects[(tap??p.slots[deckId][0]).toLowerCase()];
        const bpm=d.bpm*(1+d.pitch/100);
        channel.effects(bpm,fx.bypass?null:tap,fx.bypass?null:hold,effect.dryWet/100,effect.amount/100);
        const bank=p.banks[deckId];
        channel.ambience.apply(fx.bypass?0:fav==="Hall"?Math.max(65,fx.hall):fx.hall,bank.decay,bank.tone,fav==="DJ International",bpm,!fx.bypass&&fx.quickEcho);
        const route = d.headphoneCue ? p.device : "";
        if (cueRoute !== route) {
          cueRoute = route;
          void channel.cue(route, !!route).catch(() => {
            if (current()) useDjStore.getState().updateDeck(deckId,{headphoneCue:false,error:"Select an available headphone output in Settings."});
          });
        }
      };
      const off = [useLive.subscribe((s,p) => { if (s[deckId] !== p[deckId]) configure(); }),
        usePreferences.subscribe(configure), useDjStore.subscribe((s,p) => {
          const a = s.decks[deckId], b = p.decks[deckId];
          if (a.eq !== b.eq || a.headphoneCue !== b.headphoneCue || a.pitch !== b.pitch || a.bpm !== b.bpm || s.effects!==p.effects) configure();
        })];
      const player: YouTubeDeckPlayer = {
        deckId,
        play: () => { void (async () => {
          const sequence=++intent;
          await audioEngine.initialize();
          if (!current() || sequence!==intent) return;
          if (!channel) {
            path.channel=channel=new LiveChannel(audioEngine.context(),audio,audioEngine.deckOutput());
          }
          channels.set(deckId,channel);
          channel.volume(outputVolumeRef.current);
          configure();
          await audio.play();
        })().catch(() => fail("Could not play this audio file. Try an MP3 or WAV.")); },
        pause: () => {intent++;audio.pause();},
        stop: () => { audio.pause(); audio.currentTime = 0; },
        cue: () => { audio.currentTime = 0; },
        seekTo: seconds => { audio.currentTime = seconds; },
        setVolume: volume => channel?.volume(volume),
        setPlaybackRate: rate => { audio.playbackRate = rate; },
        getPlaybackRate: () => audio.playbackRate,
        getDuration: () => Number.isFinite(audio.duration) ? audio.duration : 0,
        getCurrentTime: () => audio.currentTime,
        destroy: () => { audio.pause(); audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(url); }
      };
      audio.onloadedmetadata = () => ready(player);
      audio.onplaying = () => playback(true);
      audio.onpause = audio.onended = () => playback(false);
      audio.onerror = () => fail("Could not read this audio file. Try an MP3 or WAV.");
      audio.preload = "auto";
      audio.src = url;
      releaseFile = () => {
        off.forEach(stop => stop());
        intent++;
        audio.onloadedmetadata=audio.onplaying=audio.onpause=audio.onended=audio.onerror=null;
        channel?.volume(0);
        void channel?.cue("",false);
        channels.delete(deckId); player.destroy();
      };
    } else if (deck.videoId) {
      const mount = document.createElement("div");
      host.replaceChildren(mount);
      void createYouTubeDeckPlayer(deckId, mount, deck.videoId, {
        onPlaying: () => playback(true),
        onPaused: () => playback(false),
        onEnded: () => playback(false),
        onError: event => fail(youtubeErrorMessage(event.data)),
        onAutoplayBlocked: () => {
          if (current()) useDjStore.getState().updateDeck(deckId, {isPlaying:false,error:"Playback blocked. Press Play here, or switch back to the previous deck."});
        }
      }, controller.signal).then(ready).catch(error => fail(error.message));
    }

    return () => {
      controller.abort();
      deckPlayerRegistry.unregister(deckId, playerRef.current);
      releaseFile?.();
      resetFx(deckId);
      changeLive(deckId,{loop:0});
      host.replaceChildren();
      playerRef.current = null;
    };
  }, [deck.videoId, deck.localFile, deck.autoPlay, deck.loadId, deckId, elementId]);

  const loop = useLive(s => s[deckId].loop);
  useEffect(() => {
    if (!loop) return;
    const timer = window.setInterval(() => {
      const d = useDjStore.getState().decks[deckId];
      const p = playerRef.current;
      const start = useLive.getState()[deckId].loopStart;
      if (p && d.isPlaying && p.getCurrentTime() >= Math.min(start + loop * 60 / d.bpm, d.duration - 0.03)) p.seekTo(start);
    }, 16);
    return () => window.clearInterval(timer);
  }, [deckId,loop]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      useDjStore.getState().setDeckPosition(deckId, player.getCurrentTime(), player.getDuration());
    }, 250);

    return () => window.clearInterval(timer);
  }, [deckId]);

  const play = useCallback(() => playerRef.current?.play(), []);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const seekTo = useCallback(
    (seconds: number) => {
      const deckState = useDjStore.getState().decks[deckId];
      const duration = deckState.duration || playerRef.current?.getDuration() || 0;
      const nextTime = Math.min(Math.max(0, seconds), duration || Math.max(0, seconds));
      playerRef.current?.seekTo(nextTime);
      useDjStore.getState().setDeckPosition(deckId, nextTime, duration);
    },
    [deckId]
  );
  const jog = useCallback(
    (deltaSeconds: number) => {
      const player = playerRef.current;
      const currentTime = player?.getCurrentTime() ?? useDjStore.getState().decks[deckId].currentTime;
      seekTo(currentTime + deltaSeconds);
    },
    [deckId, seekTo]
  );
  const cue = useCallback(() => {
    seekTo(0);
  }, [seekTo]);
  const pitchBend = useCallback(
    (direction: "backward" | "forward") => {
      const player = playerRef.current;
      if (!player) {
        useDjStore.getState().updateDeck(deckId, { error: "Load a playable video before pitch bending." });
        return;
      }

      const deckState = useDjStore.getState().decks[deckId];
      const baseRate = Math.min(2, Math.max(0.25, 1 + deckState.pitch / 100));
      const bendRate = direction === "forward" ? baseRate + 0.12 : baseRate - 0.12;
      player.setPlaybackRate(Math.min(2, Math.max(0.25, bendRate)));
      window.setTimeout(() => player.setPlaybackRate(baseRate), 520);
    },
    [deckId]
  );
  const setPitchRate = useCallback((pitch: number) => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    player.setPlaybackRate(Math.min(2, Math.max(0.25, 1 + pitch / 100)));
  }, []);
  const scratch = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      useDjStore.getState().updateDeck(deckId, { error: "Load a playable video before scratching." });
      return;
    }

    void audioEngine.previewTone("vinyl-scratch", 92);
    const start = player.getCurrentTime();
    const pattern = [0.08, -0.1, 0.12, -0.14, 0.1, -0.08, 0.04];
    pattern.forEach((offset, index) => {
      window.setTimeout(() => seekTo(start + offset), index * 55);
    });
  }, [deckId, seekTo]);
  const backspin = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      useDjStore.getState().updateDeck(deckId, { error: "Load a playable video before backspin." });
      return;
    }

    void audioEngine.previewTone("backspin", 95);
    const start = player.getCurrentTime();
    Array.from({ length: 12 }, (_, index) => index + 1).forEach((step) => {
      window.setTimeout(() => seekTo(start - step * 0.55), step * 58);
    });
  }, [deckId, seekTo]);
  const reverseEffect = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      useDjStore.getState().updateDeck(deckId, { error: "Load a playable video before reverse effect." });
      return;
    }

    void audioEngine.previewTone("reverse", 86);
    const start = player.getCurrentTime();
    Array.from({ length: 10 }, (_, index) => index + 1).forEach((step) => {
      window.setTimeout(() => seekTo(start - step * 0.22), step * 85);
    });
  }, [deckId, seekTo]);
  const syncTo = useCallback(
    (targetDeckId: DeckId) => {
      const target = useDjStore.getState().decks[targetDeckId];
      useDjStore.getState().syncDeck(deckId, targetDeckId);
      playerRef.current?.setPlaybackRate(1 + useDjStore.getState().decks[deckId].pitch / 100);
      seekTo(target.currentTime);
    },
    [deckId, seekTo]
  );

  return {
    play,
    pause,
    seekTo,
    jog,
    setPitchRate,
    cue,
    pitchBend,
    scratch,
    backspin,
    reverseEffect,
    syncTo,
    outputVolume
  };
}
