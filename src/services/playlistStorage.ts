import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { PlaylistTrack } from "../types/dj";

const LOCAL_STORAGE_KEY = "dj-studio-playlist";
const RECORDING_BUCKET = import.meta.env.VITE_SUPABASE_RECORDINGS_BUCKET ?? "dj-recordings";

export const playlistStorage = {
  async loadPlaylist(): Promise<PlaylistTrack[]> {
    if (!isSupabaseConfigured || !supabase) {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? "[]") as PlaylistTrack[];
    }

    const { data, error } = await supabase
      .from("dj_playlists")
      .select("tracks")
      .eq("name", "default")
      .maybeSingle<{ tracks: PlaylistTrack[] }>();

    if (error || !data) {
      return [];
    }

    return data.tracks ?? [];
  },

  async savePlaylist(tracks: PlaylistTrack[]) {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tracks));
      return;
    }

    await supabase.from("dj_playlists").upsert({
      name: "default",
      tracks,
      updated_at: new Date().toISOString()
    });
  },

  async uploadRecording(blob: Blob, filename: string) {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    const { data, error } = await supabase.storage.from(RECORDING_BUCKET).upload(filename, blob, {
      cacheControl: "3600",
      contentType: blob.type,
      upsert: false
    });

    if (error) {
      throw error;
    }

    return data.path;
  }
};
