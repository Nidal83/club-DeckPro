import { useEffect } from "react";
import { moveFader,stopFade } from "../services/crossfade";
import { deckPlayerRegistry } from "../services/deckPlayerRegistry";
import { useDjStore } from "../store/djStore";
import { triggerSlot, usePreferences, holdFavorite, releaseFavorite, international } from "../store/performance";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable ||
    Boolean(target.closest("[role='slider']"))
  );
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    const held = new Map<string,"A"|"B">();
    const presetKeys = new Map<string,"A"|"B">();
    const release = (e: KeyboardEvent) => {
      const code = e.code || e.key, id = held.get(code);
      if (id) { triggerSlot(id,1,false); held.delete(code); }
      const preset=presetKeys.get(code);
      if(preset){releaseFavorite(preset,"shortcut");presetKeys.delete(code);}
    };
    const releaseAll = () => {
      for (const id of useDjStore.getState().visibleDeckIds) {triggerSlot(id,1,false);releaseFavorite(id);}
      presetKeys.clear();
      held.clear();
    };
    const visibility = () => { if (document.hidden) releaseAll(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.isComposing || isEditableTarget(event.target)) {
        return;
      }

      const { activeDeckId, mixer } = useDjStore.getState();
      const seekAmount = event.shiftKey ? 5 : event.altKey ? 0.25 : 1;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        deckPlayerRegistry.seekRelative(activeDeckId, -seekAmount);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        deckPlayerRegistry.seekRelative(activeDeckId, seekAmount);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        deckPlayerRegistry.pitchBend(activeDeckId, "forward");
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        deckPlayerRegistry.pitchBend(activeDeckId, "backward");
        return;
      }

      const key = event.key.toLowerCase();
      const action = Object.entries(usePreferences.getState().keys).find(([,value])=>value===key)?.[0];
      if (action && !event.altKey) {
        event.preventDefault();
        if (event.repeat) return;
        const id = action.endsWith("A") ? "A" : "B";
        if (action.startsWith("play")) {
          const d = useDjStore.getState().decks[id];
          if (d.isPlaying) deckPlayerRegistry.pause(id); else deckPlayerRegistry.play(id);
        } else if(action.startsWith("preset")) {
          presetKeys.set(event.code||event.key,id);holdFavorite(id,international,"shortcut");
        } else if (action.startsWith("first")) triggerSlot(id,0,true);
        else { held.set(event.code || event.key,id); triggerSlot(id,1,true); }
        return;
      }
      if (key === "q") {
        event.preventDefault();
        moveFader(Math.max(0, mixer.crossfader - 5));
        return;
      }

      if (key === "w") {
        event.preventDefault();
        moveFader(50);
        return;
      }

      if (key === "a") {
        event.preventDefault();
        moveFader(Math.min(100, mixer.crossfader + 5));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",release);
    window.addEventListener("blur",releaseAll);
    document.addEventListener("visibilitychange",visibility);
    return () => {
      stopFade();
      releaseAll();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",release);
      window.removeEventListener("blur",releaseAll);
      document.removeEventListener("visibilitychange",visibility);
    };
  }, []);
}
