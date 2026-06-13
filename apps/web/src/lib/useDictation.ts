import { useCallback, useEffect, useRef, useState } from "react";
import { DEEPGRAM_LIVE_SAMPLE_RATE, downmixToMono, LivePcmEncoder } from "./livePcm";

export type DictationStatus = "idle" | "connecting" | "listening" | "finishing" | "error";

const FINALIZE_TIMEOUT_MS = 2_500;
const FORCE_CLOSE_TIMEOUT_MS = 250;
const PCM_BUFFER_SIZE = 4_096;

/** Browser-side speech-to-text through our Deepgram streaming WebSocket proxy.
 *
 * Flow: open getUserMedia + Web Audio capture, downmix/resample to 16 kHz mono
 * PCM, then pipe those frames through our Worker to Deepgram. Final transcripts
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
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sinkNodeRef = useRef<GainNode | null>(null);
  const encoderRef = useRef<LivePcmEncoder | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRequestedRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.AudioContext !== "undefined" &&
    typeof WebSocket !== "undefined";

  const clearCloseTimers = useCallback(() => {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    if (forceCloseTimerRef.current) {
      clearTimeout(forceCloseTimerRef.current);
      forceCloseTimerRef.current = null;
    }
  }, []);

  const stopCapture = useCallback(() => {
    processorNodeRef.current?.disconnect();
    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null;
    }
    processorNodeRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    sinkNodeRef.current?.disconnect();
    sinkNodeRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) {
      void audioContext.close().catch(() => {
        // Best-effort shutdown only.
      });
    }

    encoderRef.current = null;

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const requestSocketClose = useCallback(
    (socket: WebSocket) => {
      clearCloseTimers();
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: "CloseStream" }));
        } catch {
          // Closing below regardless.
        }
      }
      forceCloseTimerRef.current = setTimeout(() => {
        if (socket.readyState !== WebSocket.CLOSED) {
          socket.close(1000, "dictation stopped");
        }
      }, FORCE_CLOSE_TIMEOUT_MS);
    },
    [clearCloseTimers],
  );

  const teardown = useCallback(
    (options?: { closeSocket?: boolean; resetStopRequest?: boolean; socket?: WebSocket }) => {
      clearCloseTimers();
      stopCapture();
      if (options?.resetStopRequest !== false) {
        stopRequestedRef.current = false;
      }
      const ws = options?.socket ?? wsRef.current;
      if (options?.closeSocket !== false) {
        wsRef.current = null;
        if (ws && ws.readyState !== WebSocket.CLOSED) {
          ws.close();
        }
      }
    },
    [clearCloseTimers, stopCapture],
  );

  const finishStop = useCallback(
    (socket: WebSocket) => {
      teardown({ closeSocket: false, socket });
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      if (socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
      setError(null);
      setInterim("");
      setStatus("idle");
    },
    [teardown],
  );

  const failSession = useCallback(
    (socket: WebSocket, message: string) => {
      teardown({ closeSocket: false, socket });
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      if (socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
      setError(message);
      setStatus("error");
    },
    [teardown],
  );

  const finalizeSession = useCallback(
    (socket: WebSocket) => {
      stopRequestedRef.current = true;
      stopCapture();
      setInterim("");
      setStatus("finishing");
      clearCloseTimers();
      if (socket.readyState !== WebSocket.OPEN) {
        finishStop(socket);
        return;
      }
      try {
        socket.send(JSON.stringify({ type: "Finalize" }));
      } catch {
        requestSocketClose(socket);
        return;
      }
      finalizeTimerRef.current = setTimeout(() => {
        requestSocketClose(socket);
      }, FINALIZE_TIMEOUT_MS);
    },
    [clearCloseTimers, finishStop, requestSocketClose, stopCapture],
  );

  const createPcmCapture = useCallback(async (stream: MediaStream, socket: WebSocket) => {
    const audioContext = new AudioContext({
      latencyHint: "interactive",
      sampleRate: DEEPGRAM_LIVE_SAMPLE_RATE,
    });
    audioContextRef.current = audioContext;
    await audioContext.resume();

    if (wsRef.current !== socket) {
      void audioContext.close().catch(() => {
        // Best-effort shutdown only.
      });
      return;
    }

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(PCM_BUFFER_SIZE, 2, 1);
    const sink = audioContext.createGain();
    sink.gain.value = 0;

    encoderRef.current = new LivePcmEncoder();
    sourceNodeRef.current = source;
    processorNodeRef.current = processor;
    sinkNodeRef.current = sink;

    processor.onaudioprocess = (event) => {
      if (stopRequestedRef.current || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      const pcm = encoderRef.current?.encode(
        downmixToMono(event.inputBuffer),
        audioContext.sampleRate,
      );
      if (pcm && socket.readyState === WebSocket.OPEN) {
        socket.send(pcm);
      }
    };

    source.connect(processor);
    processor.connect(sink);
    sink.connect(audioContext.destination);
  }, []);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) {
      teardown();
      setInterim("");
      setStatus((current) => (current === "error" ? current : "idle"));
      return;
    }
    if (status === "listening") {
      finalizeSession(ws);
      return;
    }
    teardown({ socket: ws });
    setInterim("");
    setStatus((current) => (current === "error" ? current : "idle"));
  }, [finalizeSession, status, teardown]);

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
    stopRequestedRef.current = false;
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch {
      setError("Microphone access was blocked.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;

    const ws = new WebSocket(voiceProxyUrl());
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      if (wsRef.current !== ws) {
        return;
      }
      if (stopRequestedRef.current) {
        requestSocketClose(ws);
        return;
      }
      setStatus("listening");
    });

    ws.addEventListener("message", (event) => {
      if (wsRef.current !== ws) {
        return;
      }
      let payload: DeepgramMessage;
      try {
        payload = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (payload.type === "Error") {
        failSession(
          ws,
          payload.message || payload.description || "Voice connection closed. Please try again.",
        );
        return;
      }
      const text = payload.channel?.alternatives?.[0]?.transcript ?? "";
      const isCommitted = payload.is_final || payload.speech_final || payload.from_finalize;
      if (!text) {
        if (payload.from_finalize && stopRequestedRef.current) {
          requestSocketClose(ws);
        }
        return;
      }
      if (isCommitted) {
        setCommitted((current) => (current ? `${current} ${text}` : text));
        setInterim("");
      } else {
        setInterim(text);
      }
      if (payload.from_finalize && stopRequestedRef.current) {
        requestSocketClose(ws);
      }
    });

    ws.addEventListener("error", () => {
      if (wsRef.current !== ws) {
        return;
      }
      if (stopRequestedRef.current) {
        finishStop(ws);
        return;
      }
      failSession(ws, "Voice connection dropped.");
    });

    ws.addEventListener("close", (event) => {
      if (wsRef.current !== ws) {
        return;
      }
      if (stopRequestedRef.current) {
        finishStop(ws);
        return;
      }
      failSession(ws, voiceConnectionClosedMessage(event));
    });

    try {
      await createPcmCapture(stream, ws);
    } catch {
      if (wsRef.current !== ws) {
        return;
      }
      failSession(ws, "Could not start audio capture.");
    }
  }, [createPcmCapture, failSession, finishStop, requestSocketClose, supported]);

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

function voiceProxyUrl() {
  const url = new URL("/api/ai/voice/listen", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function voiceConnectionClosedMessage(event: CloseEvent) {
  if (event.reason.toUpperCase().includes("NET-0001")) {
    return "Voice connection timed out. Please try again.";
  }
  return "Voice connection closed. Please try again.";
}

type DeepgramMessage = {
  type?: string;
  description?: string;
  from_finalize?: boolean;
  is_final?: boolean;
  message?: string;
  speech_final?: boolean;
  channel?: { alternatives?: Array<{ transcript?: string }> };
};
