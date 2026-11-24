import { Bot, Sparkles } from "lucide-react";
import { useDjStore } from "../../store/djStore";
import { ControlButton } from "./ControlButton";

export function AiAssistant() {
  const aiSuggestions = useDjStore((state) => state.aiSuggestions);
  const regenerateAiSuggestions = useDjStore((state) => state.regenerateAiSuggestions);

  return (
    <section className="dj-panel grid gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase text-sky-300">AI DJ</p>
          <h2 className="text-xl font-black text-white">Assistant</h2>
        </div>
        <ControlButton data-hint="Update suggestions." label="Refresh AI suggestions" tone="blue" onClick={regenerateAiSuggestions}>
          <Sparkles size={17} />
        </ControlButton>
      </div>

      <div className="grid gap-3">
        {aiSuggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-md border border-white/10 bg-black/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-black text-white">
                <Bot size={16} className="text-amber-200" />
                {suggestion.label}
              </span>
              <span className="rounded bg-sky-400/10 px-2 py-1 text-xs font-black text-sky-200">{suggestion.confidence}%</span>
            </div>
            <p className="text-sm font-semibold text-zinc-400">{suggestion.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
