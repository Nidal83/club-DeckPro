import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ListMusic, Save, Search, Trash2 } from "lucide-react";
import { analyzeYouTubeTempo } from "../../bpm/bpmAnalyzer";
import { playlistStorage } from "../../services/playlistStorage";
import { fetchYouTubeTrackMeta } from "../../services/youtubeService";
import { useDjStore } from "../../store/djStore";
import type { DeckId, PlaylistTrack } from "../../types/dj";
import { ControlButton } from "./ControlButton";

export function PlaylistPanel() {
  const playlist = useDjStore((state) => state.playlist);
  const addPlaylistTrack = useDjStore((state) => state.addPlaylistTrack);
  const removePlaylistTrack = useDjStore((state) => state.removePlaylistTrack);
  const reorderPlaylist = useDjStore((state) => state.reorderPlaylist);
  const queueTrack = useDjStore((state) => state.queueTrack);
  const loadYouTubeTrack = useDjStore((state) => state.loadYouTubeTrack);
  const setPlaylist = useDjStore((state) => state.setPlaylist);
  const visibleDeckIds = useDjStore((state) => state.visibleDeckIds);
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const playlistLoadedRef = useRef(false);

  useEffect(() => {
    let active = true;
    playlistStorage
      .loadPlaylist()
      .then((tracks) => {
        if (!active) {
          return;
        }

        setPlaylist(tracks);
        playlistLoadedRef.current = true;
        setStatus(tracks.length ? "Loaded" : "Ready");
      })
      .catch(() => {
        playlistLoadedRef.current = true;
        setStatus("Local playlist mode");
      });

    return () => {
      active = false;
    };
  }, [setPlaylist]);

  useEffect(() => {
    if (!playlistLoadedRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      playlistStorage
        .savePlaylist(playlist)
        .then(() => setStatus("Saved"))
        .catch(() => setStatus("Local save error"));
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [playlist]);

  const filteredPlaylist = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return playlist;
    }

    return playlist.filter((track) => track.title.toLowerCase().includes(normalized) || track.url.toLowerCase().includes(normalized));
  }, [playlist, query]);

  const addTrack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUrl = url.trim();
    if (!nextUrl) {
      setStatus("Paste a link");
      return;
    }

    if (playlist.some((track) => track.url === nextUrl)) {
      setStatus("Already queued");
      return;
    }

    setStatus("Adding");

    try {
      const meta = await fetchYouTubeTrackMeta(nextUrl);
      const analysis = analyzeYouTubeTempo(meta.videoId, meta.title);
      const track: PlaylistTrack = {
        id: crypto.randomUUID(),
        url: nextUrl,
        videoId: meta.videoId,
        title: meta.title,
        bpm: analysis.bpm,
        queuedDeck: null,
        createdAt: new Date().toISOString()
      };

      addPlaylistTrack(track);
      setUrl("");
      setStatus("Added");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to add");
    }
  };

  const savePlaylist = async () => {
    setStatus("Saving");
    await playlistStorage.savePlaylist(playlist);
    setStatus("Saved");
  };

  const loadIntoDeck = (track: PlaylistTrack, deckId: DeckId) => {
    setStatus(`Deck ${deckId}`);
    queueTrack(track.id, deckId);
    void loadYouTubeTrack(deckId, track.url);
  };

  const loadNextTrack = (deckId: DeckId) => {
    const [track] = playlist;
    if (!track) {
      setStatus("Queue empty");
      return;
    }

    loadIntoDeck(track, deckId);
  };

  return (
    <section className="dj-panel grid content-start gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase text-sky-300">Library</p>
          <h2 className="text-xl font-black text-white">Playlist Queue</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold uppercase text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <ListMusic size={16} />
            {status}
          </span>
          {visibleDeckIds.map((deckId) => (
            <ControlButton
              key={deckId}
              data-hint="Load the first track." label={`Load next track to deck ${deckId}`}
              className="h-8 px-2"
              onClick={() => loadNextTrack(deckId)}
              disabled={playlist.length === 0}
            >
              Next {deckId}
            </ControlButton>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_0.75fr_auto]">
        <form onSubmit={addTrack} className="flex gap-2">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Add YouTube link"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/45 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-300"
          />
          <ControlButton type="submit" data-hint="Add to queue." label="Add YouTube link" tone="blue">
            +
          </ControlButton>
        </form>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search playlist"
            className="w-full rounded-md border border-white/10 bg-black/45 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-300"
          />
        </label>
        <ControlButton data-hint="Save this queue." label="Save playlist" tone="amber" onClick={() => void savePlaylist()}>
          <Save size={17} />
        </ControlButton>
      </div>

      <div className="max-h-96 overflow-auto rounded-md border border-white/10">
        {filteredPlaylist.length === 0 ? (
          <div className="p-5 text-sm font-semibold text-zinc-500">No tracks queued</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredPlaylist.map((track, index) => (
              <div key={track.id} className="grid gap-3 bg-black/25 p-3 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/[0.06] px-2 py-1 text-xs font-black text-zinc-400">{index + 1}</span>
                    <p className="truncate text-sm font-black text-white">{track.title}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold uppercase text-zinc-500">
                    <span>{track.bpm} BPM</span>
                    <span>{track.queuedDeck ? `Deck ${track.queuedDeck}` : "Queued"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {visibleDeckIds.map((deckId) => (
                    <ControlButton key={deckId} data-hint="Load this track." label={`Load ${track.title} to deck ${deckId}`} onClick={() => loadIntoDeck(track, deckId)}>
                      Load {deckId}
                    </ControlButton>
                  ))}
                  <ControlButton data-hint="Move earlier." label={`Move ${track.title} up`} onClick={() => reorderPlaylist(track.id, -1)}>
                    <ArrowUp size={15} />
                  </ControlButton>
                  <ControlButton data-hint="Move later." label={`Move ${track.title} down`} onClick={() => reorderPlaylist(track.id, 1)}>
                    <ArrowDown size={15} />
                  </ControlButton>
                  <ControlButton data-hint="Remove from queue." label={`Remove ${track.title}`} tone="danger" onClick={() => removePlaylistTrack(track.id)}>
                    <Trash2 size={15} />
                  </ControlButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
