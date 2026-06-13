import { useCallback, useEffect, useId, useRef } from "react";
import { useDictation } from "./useDictation";

type UseVoiceInputOptions = {
  onValueChange: (value: string) => void;
  value: string;
};

const voiceInputStartEvent = "open-cook:dictation-start";

export function useVoiceInput({ onValueChange, value }: UseVoiceInputOptions) {
  const controlId = useId();
  const dictation = useDictation();
  const baseRef = useRef("");
  const isDictating =
    dictation.status === "listening" ||
    dictation.status === "connecting" ||
    dictation.status === "finishing";

  useEffect(() => {
    function stopWhenAnotherControlStarts(event: Event) {
      if ((event as CustomEvent<string>).detail !== controlId) {
        dictation.stop();
      }
    }

    window.addEventListener(voiceInputStartEvent, stopWhenAnotherControlStarts);
    return () => {
      window.removeEventListener(voiceInputStartEvent, stopWhenAnotherControlStarts);
    };
  }, [controlId, dictation.stop]);

  useEffect(() => {
    if (!isDictating) {
      return;
    }
    const base = baseRef.current;
    onValueChange(base ? `${base} ${dictation.liveText}`.trim() : dictation.liveText);
  }, [dictation.liveText, isDictating, onValueChange]);

  const toggleDictation = useCallback(() => {
    if (isDictating) {
      dictation.stop();
      return;
    }
    window.dispatchEvent(new CustomEvent(voiceInputStartEvent, { detail: controlId }));
    baseRef.current = value;
    dictation.reset();
    void dictation.start();
  }, [controlId, dictation.reset, dictation.start, dictation.stop, isDictating, value]);

  return {
    dictation,
    isDictating,
    toggleDictation,
  };
}
