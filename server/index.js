import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4174);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "nidal-clubdeck-pro-api" });
});

app.get("/api/youtube/oembed", async (request, response) => {
  const url = String(request.query.url ?? "");

  if (!url) {
    response.status(400).json({ error: "Missing url query parameter." });
    return;
  }

  const upstream = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (!upstream.ok) {
    response.status(upstream.status).json({ error: "YouTube metadata unavailable." });
    return;
  }

  response.json(await upstream.json());
});

app.post("/api/assistant/suggestions", (request, response) => {
  const { deckA, deckB, crossfader } = request.body ?? {};
  const bpmGap = Math.abs(Number(deckA?.bpm ?? 124) - Number(deckB?.bpm ?? 126));
  const side = Number(crossfader ?? 50) < 50 ? "Deck A" : "Deck B";

  response.json({
    suggestions: [
      { label: "Best next song", value: bpmGap <= 4 ? "Tempo-compatible track" : "Bridge track recommended" },
      { label: "Best transition timing", value: `Bring ${side} in on the next downbeat` },
      { label: "Recommended effects", value: bpmGap <= 2 ? "Filter sweep and echo" : "Beat repeat before sync" }
    ]
  });
});

app.listen(port, () => {
  console.log(`Nidal-ClubDeck-pro API listening on http://localhost:${port}`);
});
