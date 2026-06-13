import { Loader2, Mic, Square } from "lucide-react";
import { useVoiceInput } from "../lib/useVoiceInput";

type DictationControlProps = {
  onValueChange: (value: string) => void;
  value: string;
};

export function DictationControl({ onValueChange, value }: DictationControlProps) {
  const { dictation, isDictating, toggleDictation } = useVoiceInput({
    onValueChange,
    value,
  });
  const isBusy =
    dictation.status === "connecting" || dictation.status === "finishing";
  const statusText =
    dictation.status === "connecting"
      ? "Connecting"
      : dictation.status === "finishing"
        ? "Finishing"
        : "Listening";

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      <button
        aria-label={isDictating ? "Stop dictation" : "Dictate with your voice"}
        className={
          isDictating
            ? "grid size-9 place-items-center rounded-lg border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark)"
            : "grid size-9 place-items-center rounded-lg border-2 border-(--color-pop-ink) bg-(--color-panel) text-(--color-pop-ink) transition hover:bg-[color-mix(in_oklch,var(--color-pop-accent)_28%,white)]"
        }
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleDictation();
        }}
        title={isDictating ? "Stop dictation" : "Dictate with your voice"}
        type="button"
      >
        {isBusy ? (
          <Loader2 className="animate-spin" size={16} />
        ) : isDictating ? (
          <Square fill="currentColor" size={14} />
        ) : (
          <Mic size={16} />
        )}
      </button>
      {isDictating || dictation.error ? (
        <span
          className={
            dictation.error
              ? "text-[11.5px] font-black normal-case leading-snug text-(--color-tomato-dark)"
              : "inline-flex items-center gap-2 text-[11.5px] font-black normal-case leading-none text-(--color-tomato-dark)"
          }
        >
          {dictation.error ? (
            dictation.error
          ) : (
            <>
              <span className="flex items-end gap-0.5" aria-hidden="true">
                <span className="h-2 w-0.5 animate-pulse bg-(--color-tomato)" />
                <span className="h-3.5 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:120ms]" />
                <span className="h-2.5 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:240ms]" />
                <span className="h-4 w-0.5 animate-pulse bg-(--color-tomato) [animation-delay:360ms]" />
              </span>
              {statusText}
            </>
          )}
        </span>
      ) : null}
    </div>
  );
}
