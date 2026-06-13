import { Loader2, Mic, Search, Square } from "lucide-react";
import {
  forwardRef,
  type InputHTMLAttributes,
  type KeyboardEventHandler,
} from "react";
import { useVoiceInput } from "../lib/useVoiceInput";

type VoiceSearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type" | "value"
> & {
  activeMicButtonClassName?: string;
  containerClassName: string;
  inputClassName?: string;
  micButtonClassName?: string;
  micIconSize?: number;
  onValueChange: (value: string) => void;
  searchIconClassName?: string;
  searchIconSize?: number;
  searchIconWrapperClassName?: string;
  statusClassName?: string;
  value: string;
};

const defaultMicButtonClassName =
  "grid size-8 place-items-center rounded-xl border-2 border-(--color-ink) bg-(--color-panel) text-(--color-ink) transition hover:bg-(--color-sage-soft) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-tomato)] disabled:cursor-not-allowed disabled:opacity-55";
const defaultActiveMicButtonClassName =
  "grid size-8 place-items-center rounded-xl border-2 border-(--color-tomato) bg-[color-mix(in_oklch,var(--color-tomato)_14%,white)] text-(--color-tomato-dark) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-tomato)]";

export const VoiceSearchInput = forwardRef<
  HTMLInputElement,
  VoiceSearchInputProps
>(function VoiceSearchInput(
  {
    activeMicButtonClassName = defaultActiveMicButtonClassName,
    containerClassName,
    disabled,
    inputClassName,
    micButtonClassName = defaultMicButtonClassName,
    micIconSize = 16,
    onKeyDown,
    onValueChange,
    searchIconClassName,
    searchIconSize = 17,
    searchIconWrapperClassName,
    statusClassName = "sr-only",
    value,
    ...inputProps
  },
  ref,
) {
  const { dictation, isDictating, toggleDictation } = useVoiceInput({
    onValueChange,
    value,
  });
  const statusText = dictation.error
    ? dictation.error
    : isDictating
      ? dictation.status === "connecting"
        ? "Connecting to voice search"
        : dictation.status === "finishing"
          ? "Finishing voice search"
        : "Listening for voice search"
      : "";
  const buttonClassName = isDictating ? activeMicButtonClassName : micButtonClassName;
  const isBusy =
    dictation.status === "connecting" || dictation.status === "finishing";

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Escape" && isDictating) {
      dictation.stop();
    }
    onKeyDown?.(event);
  };

  return (
    <>
      <div className={containerClassName}>
        {searchIconWrapperClassName ? (
          <span className={searchIconWrapperClassName}>
            <Search aria-hidden="true" size={searchIconSize} />
          </span>
        ) : (
          <Search
            aria-hidden="true"
            className={searchIconClassName}
            size={searchIconSize}
          />
        )}
        <input
          {...inputProps}
          className={inputClassName}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          ref={ref}
          type="search"
          value={value}
        />
        <button
          aria-label={isDictating ? "Stop voice search" : "Search by voice"}
          className={buttonClassName}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleDictation();
          }}
          title={isDictating ? "Stop voice search" : "Search by voice"}
          type="button"
        >
          {isBusy ? (
            <Loader2 className="animate-spin" size={micIconSize} />
          ) : isDictating ? (
            <Square fill="currentColor" size={Math.max(12, micIconSize - 2)} />
          ) : (
            <Mic size={micIconSize} />
          )}
        </button>
      </div>
      {statusText ? (
        <p
          className={statusClassName}
          role={dictation.error ? "alert" : "status"}
        >
          {statusText}
        </p>
      ) : null}
    </>
  );
});
