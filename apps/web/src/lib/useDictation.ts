import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export type DictationStatus = "idle" | "connecting" | "listening" | "error";

/** Browser-side speech-to-text over Deepgram's streaming WebSocket.
 *
 * Flow: mint a short-lived key from our Worker, open getUserMedia + a
 * MediaRecorder, and pipe audio chunks straight to Deepgram. Final transcripts
 * are appended to `committed`; the in-progress phrase is exposed as `interim`.
 *
 * There is deliberately NO automatic end-of-speech stop — Deepgram's
 * `speech_final` is ignored. The session only ends when the caller invokes
 * `stop()`, matching a press-to-talk / press-to-stop interaction. */
export function useDictation() {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [committed, setCommitted] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined" &&
    typeof WebSocket !== "undefined";

  const teardown = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "CloseStream" }));
      } catch {
        // Best-effort flush; closing below regardless.
      }
      ws.close();
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    setInterim("");
    setStatus((current) => (current === "error" ? current : "idle"));
  }, [teardown]);

  const reset = useCallback(() => {
    teardown();
    setCommitted("");
    setInterim("");
    setError(null);
    setStatus("idle");
  }, [teardown]);

  const start = useCallback(async () => {
    if (!supported) {
      setError("Voice input isn't supported in this browser.");
      setStatus("error");
      return;
    }
    setError(null);
    setInterim("");
    setStatus("connecting");

    let token: { token: string };
    try {
      token = await api.voiceToken();
    } catch {
      setError("Voice dictation isn't available right now.");
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    const params = new URLSearchParams({
      model: "nova-3",
      smart_format: "true",
      interim_results: "true",
      punctuate: "true",
    });
    // Browsers can't set an Authorization header on a WebSocket, so the JWT
    // rides in the Sec-WebSocket-Protocol subprotocol as ["bearer", <jwt>].
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, [
      "bearer",
      token.token,
    ]);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      });
      recorder.start(250);
      setStatus("listening");
    });

    ws.addEventListener("message", (event) => {
      let payload: DeepgramMessage;
      try {
        payload = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const text = payload.channel?.alternatives?.[0]?.transcript ?? "";
      if (!text) {
        return;
      }
      if (payload.is_final) {
        setCommitted((current) => (current ? `${current} ${text}` : text));
        setInterim("");
      } else {
        setInterim(text);
      }
    });

    ws.addEventListener("error", () => {
      setError("Voice connection dropped.");
      setStatus("error");
      teardown();
    });
  }, [supported, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  const liveText = interim ? `${committed} ${interim}`.trim() : committed;

  return {
    status,
    committed,
    interim,
    liveText,
    error,
    supported,
    start,
    stop,
    reset,
  };
}

type DeepgramMessage = {
  is_final?: boolean;
  channel?: { alternatives?: Array<{ transcript?: string }> };
};
