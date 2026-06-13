import type { Env } from "../AppContext";

export class DeepgramUnavailableError extends Error {}
export class DeepgramRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly providerMessage?: string,
  ) {
    super(message);
    this.name = "DeepgramRequestError";
  }
}

const ERROR_BODY_LIMIT = 500;
const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_KEEPALIVE_INTERVAL_MS = 3_000;
const DEEPGRAM_KEEPALIVE_MESSAGE = JSON.stringify({ type: "KeepAlive" });

export function buildDeepgramListenUrl() {
  const url = new URL(DEEPGRAM_LISTEN_URL);
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("sample_rate", "16000");
  url.searchParams.set("channels", "1");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("language", "multi");
  return url.toString();
}

export async function createDeepgramListenProxy(
  request: Request,
  env: Env["Bindings"],
): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade request.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
      status: 426,
    });
  }

  const apiKey = env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    throw new DeepgramUnavailableError("Deepgram voice is not configured.");
  }

  const deepgramResponse = await fetch(buildDeepgramListenUrl(), {
    headers: {
      Authorization: `Token ${apiKey}`,
      Upgrade: "websocket",
    },
  });

  const deepgramSocket = deepgramResponse.webSocket;
  if (!deepgramSocket) {
    const providerMessage = await deepgramResponse
      .text()
      .then((text) => sanitizeProviderMessage(text))
      .catch(() => undefined);
    throw new DeepgramRequestError(
      `Deepgram listen connection failed (${deepgramResponse.status}).`,
      deepgramResponse.status,
      providerMessage,
    );
  }

  const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

  proxyWebSockets(server, deepgramSocket);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

function proxyWebSockets(clientSocket: WebSocket, deepgramSocket: WebSocket) {
  clientSocket.binaryType = "arraybuffer";
  deepgramSocket.binaryType = "arraybuffer";
  clientSocket.accept({ allowHalfOpen: true });
  deepgramSocket.accept({ allowHalfOpen: true });

  let keepAliveInterval: ReturnType<typeof setInterval> | undefined = setInterval(
    () => {
      if (!sendIfOpen(deepgramSocket, DEEPGRAM_KEEPALIVE_MESSAGE)) {
        stopKeepAlive();
      }
    },
    DEEPGRAM_KEEPALIVE_INTERVAL_MS,
  );

  function stopKeepAlive() {
    if (!keepAliveInterval) {
      return;
    }
    clearInterval(keepAliveInterval);
    keepAliveInterval = undefined;
  }

  clientSocket.addEventListener("message", (event) => {
    sendIfOpen(deepgramSocket, event.data);
  });
  deepgramSocket.addEventListener("message", (event) => {
    sendIfOpen(clientSocket, event.data);
  });

  clientSocket.addEventListener("close", (event) => {
    stopKeepAlive();
    closeSocket(deepgramSocket, event, "client closed");
    closeSocket(clientSocket, event, "client closed");
  });
  deepgramSocket.addEventListener("close", (event) => {
    stopKeepAlive();
    closeSocket(clientSocket, event, "deepgram closed");
    closeSocket(deepgramSocket, event, "deepgram closed");
  });

  clientSocket.addEventListener("error", () => {
    stopKeepAlive();
    closeSocket(deepgramSocket, undefined, "client error");
    closeSocket(clientSocket, undefined, "client error");
  });
  deepgramSocket.addEventListener("error", () => {
    stopKeepAlive();
    closeSocket(clientSocket, undefined, "deepgram error");
    closeSocket(deepgramSocket, undefined, "deepgram error");
  });
}

function sendIfOpen(socket: WebSocket, data: unknown) {
  if (socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    socket.send(data as string | ArrayBuffer | ArrayBufferView);
    return true;
  } catch {
    closeSocket(socket, undefined, "send failed");
    return false;
  }
}

function closeSocket(socket: WebSocket, event: CloseEvent | undefined, reason: string) {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  try {
    socket.close(safeCloseCode(event?.code), safeCloseReason(event?.reason || reason));
  } catch {
    try {
      socket.close(1011, reason);
    } catch {
      // Nothing useful left to do once close itself fails.
    }
  }
}

function safeCloseCode(code: number | undefined) {
  if (
    code &&
    code >= 1000 &&
    code < 5000 &&
    code !== 1005 &&
    code !== 1006 &&
    code !== 1015
  ) {
    return code;
  }
  return 1011;
}

function safeCloseReason(reason: string) {
  return reason.length > 120 ? reason.slice(0, 120) : reason;
}

function sanitizeProviderMessage(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, ERROR_BODY_LIMIT) : undefined;
}
