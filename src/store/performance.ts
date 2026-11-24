import { create } from "zustand";
import { holdEffects, tapEffects, liveEffects, type LiveEffect } from "../audio/liveChannel";
import { useDjStore, deckSlots } from "./djStore";
import { deckPlayerRegistry } from "../services/deckPlayerRegistry";
import type { DeckId } from "../types/dj";

const defaults = { playA: "z", playB: "m", firstA: "x", firstB: "n", secondA: "c", secondB: "b", presetA:"g",presetB:"h" };
export const international = "DJ International";
export type Favorite = LiveEffect | typeof international | "Hall";
export const favorites: Favorite[] = [international,"Hall",...liveEffects];
interface Bank { pins: (Favorite|null)[]; decay:number; tone:number }
export type Action = keyof typeof defaults;
export type Slot = 0 | 1;
type Slots = [LiveEffect, LiveEffect];
interface Preferences { classic:boolean; showHints:boolean; keys: typeof defaults; slots: Record<DeckId, Slots>; device: string; banks:Record<DeckId,Bank> }
const storageKey = "clubdeck.performance.v1";
declare global { interface Window { performancePrefs?: { read(): string | null; write(value: string): void } } }
const initial: Preferences = {
  showHints:true,
  classic:true,
  banks:Object.fromEntries(deckSlots.map(id=>[id,{pins:[international,null,null,null], decay:2.4,tone:4600}])) as Preferences["banks"],
  keys: { ...defaults }, slots: Object.fromEntries(deckSlots.map(id => [id, ["Echo", "Beat Roll"]])) as Preferences["slots"], device: ""
};
const allowed = (key: string) => /^[a-z0-9]$/.test(key) && !["q","w","a"].includes(key);
try {
  const data = JSON.parse(window.performancePrefs?.read() || localStorage.getItem(storageKey) || "{}");
  if(typeof data.showHints === "boolean") initial.showHints=data.showHints;
  if(typeof data.classic === "boolean") initial.classic=data.classic;
  const keys = Object.keys(defaults) as Action[];
  const used = new Set(["q","w","a"]);
  for(const k of keys) {
    const saved=data.keys?.[k];
    if(typeof saved==="string" && allowed(saved) && !used.has(saved)) {initial.keys[k]=saved;used.add(saved);}
  }
  for(const k of keys.filter(k=>initial.keys[k]!==data.keys?.[k])) {
    const free=[defaults[k],..."abcdefghijklmnopqrstuvwxyz0123456789"].find(key=>!used.has(key))!;
    initial.keys[k]=free; used.add(free);
  }
  for (const id of deckSlots) {
    const slots = data.slots?.[id];
    const bank=data.banks?.[id];
    if(bank) {
      initial.banks[id]={
        pins:Array.from({length:4},(_,i)=>favorites.includes(bank.pins?.[i])?bank.pins[i]:null),
        decay:[1.2,1.8,2.4,3.2,4].includes(bank.decay)?bank.decay:2.4,
        tone:Number.isFinite(bank.tone)?Math.min(9000,Math.max(2000,bank.tone)):4600
      };
    }
    if (Array.isArray(slots) && tapEffects.some(f=>f===slots[0]) && holdEffects.some(f=>f===slots[1])) initial.slots[id] = slots as Slots;
  }
  if (typeof data.device === "string") initial.device = data.device;
} catch { /* Use defaults when storage is unavailable. */ }
export const usePreferences = create<Preferences>(() => initial);
usePreferences.subscribe(p => {
  try {
    const value = JSON.stringify(p);
    if (window.performancePrefs) window.performancePrefs.write(value);
    else localStorage.setItem(storageKey, value);
  } catch { /* Session settings still apply. */ }
});
export function remap(action: Action, key: string) {
  if (!allowed(key) || Object.entries(usePreferences.getState().keys).some(([a,k]) => a !== action && k === key)) return false;
  usePreferences.setState(p => ({keys: {...p.keys, [action]: key}})); return true;
}
export function assignSlot(id: DeckId, slot: Slot, effect: LiveEffect) {
  if (!liveEffects.includes(effect)) return;
  changeLive(id, slot === 0 ? { echo: false,quickEcho:false } : { roll: false });
  usePreferences.setState(p => {
    const next: Slots = [...p.slots[id]];
    next[slot] = effect;
    return {slots: {...p.slots, [id]: next}};
  });
}
export function setBank(id:DeckId, patch:Partial<Bank>) {
  usePreferences.setState(p=>({banks:{...p.banks,[id]:{...p.banks[id],...patch}}}));
}
export interface LiveState { filter: number; hall:number; favorite:Favorite|null; owner:string; echo: boolean; quickEcho:boolean; roll: boolean; bypass: boolean; loop: number; loopStart: number }
const neutral: LiveState = { filter: 0, hall:0,favorite:null,owner:"", echo: false, quickEcho:false, roll: false, bypass: false, loop: 0, loopStart: 0 };
export const useLive = create<Record<DeckId,LiveState>>(() => Object.fromEntries(deckSlots.map(id => [id,{...neutral}])) as Record<DeckId,LiveState>);
export function changeLive(id: DeckId, patch: Partial<LiveState>) { useLive.setState(s => ({[id]: {...s[id], ...patch}})); }
export const resetFx = (id: DeckId) => changeLive(id, { filter: 0,hall:0,favorite:null,owner:"", echo: false,quickEcho:false, roll: false, bypass: false });
export function holdFavorite(id:DeckId, favorite:Favorite, owner:string) {
  const d=useDjStore.getState().decks[id];
  if(d.localFile && d.status==="ready" && !useLive.getState()[id].bypass) changeLive(id,{favorite,owner});
}
export function releaseFavorite(id:DeckId, owner?:string) {
  const fx=useLive.getState()[id];
  if(fx.favorite && (!owner || fx.owner===owner)) changeLive(id,{favorite:null,owner:""});
}
export function triggerSlot(id: DeckId, slot: Slot, down: boolean) {
  const d = useDjStore.getState().decks[id];
  const state = useLive.getState()[id];
  if (!down && slot === 1) { if (state.roll) changeLive(id,{roll:false}); return; }
  if (!down || !d.localFile || d.status !== "ready" || state.bypass) return;
  changeLive(id, slot === 0 ? {echo: !state.echo} : {roll:true});
}
export function toggleLoop(id: DeckId, beats: number) {
  const state = useLive.getState()[id];
  const player = deckPlayerRegistry.get(id);
  if (!player) return;
  changeLive(id, { loop: state.loop === beats ? 0 : beats, loopStart: player.getCurrentTime() });
}
