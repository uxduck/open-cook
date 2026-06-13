import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDeepgramListenUrl,
  createDeepgramListenProxy,
  DeepgramRequestError,
  DeepgramUnavailableError,
} from "./deepgram";

describe("Deepgram voice proxy", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("builds the live dictation URL without using token grants", () => {
    const url = new URL(buildDeepgramListenUrl());

    expect(url.origin).toBe("https://api.deepgram.com");
    expect(url.pathname).toBe("/v1/listen");
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("encoding")).toBe("linear16");
    expect(url.searchParams.get("sample_rate")).toBe("16000");
    expect(url.searchParams.get("channels")).toBe("1");
    expect(url.searchParams.get("smart_format")).toBe("true");
    expect(url.searchParams.get("interim_results")).toBe("true");
    expect(url.searchParams.get("language")).toBe("multi");
  });

  it("requires a WebSocket upgrade request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await createDeepgramListenProxy(
      new Request("https://open-cook.test/api/ai/voice/listen"),
      { DEEPGRAM_API_KEY: "dg-global-key" },
    );

    expect(response.status).toBe(426);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports missing Deepgram configuration", async () => {
    await expect(
      createDeepgramListenProxy(webSocketRequest(), {}),
    ).rejects.toBeInstanceOf(DeepgramUnavailableError);
  });

  it("connects to Deepgram with the configured global API key", async () => {
    const fetchMock = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) => new Response(" invalid key\n", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createDeepgramListenProxy(webSocketRequest(), {
        DEEPGRAM_API_KEY: " dg-global-key ",
      }),
    ).rejects.toMatchObject({
      providerMessage: "invalid key",
      status: 401,
    } satisfies Partial<DeepgramRequestError>);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(buildDeepgramListenUrl());
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Token dg-global-key",
        Upgrade: "websocket",
      },
    });
  });

  it("keeps the upstream Deepgram stream alive while the proxy is open", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", { CLOSED: 3, OPEN: 1 });
    installWebSocketResponseMock();
    const { workerSocket } = installWebSocketPairMock();
    const deepgramSocket = new FakeWebSocket();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ webSocket: deepgramSocket })),
    );

    const response = await createDeepgramListenProxy(webSocketRequest(), {
      DEEPGRAM_API_KEY: "dg-global-key",
    });

    expect(response.status).toBe(101);
    expect(deepgramSocket.sent).toEqual([]);

    vi.advanceTimersByTime(3_000);

    expect(deepgramSocket.sent).toEqual([JSON.stringify({ type: "KeepAlive" })]);

    workerSocket.close(1000, "client stopped");
    vi.advanceTimersByTime(3_000);

    expect(deepgramSocket.sent).toHaveLength(1);
  });
});

function webSocketRequest() {
  return new Request("https://open-cook.test/api/ai/voice/listen", {
    headers: { Upgrade: "websocket" },
  });
}

function installWebSocketResponseMock() {
  class WebSocketResponse {
    readonly status: number;
    readonly webSocket?: WebSocket;

    constructor(
      _body: BodyInit | null,
      init?: ResponseInit & { webSocket?: WebSocket },
    ) {
      this.status = init?.status ?? 200;
      this.webSocket = init?.webSocket;
    }
  }

  vi.stubGlobal("Response", WebSocketResponse);
}

function installWebSocketPairMock() {
  const browserSocket = new FakeWebSocket();
  const workerSocket = new FakeWebSocket();
  vi.stubGlobal(
    "WebSocketPair",
    class {
      constructor() {
        return { 0: browserSocket, 1: workerSocket };
      }
    },
  );
  return { browserSocket, workerSocket };
}

class FakeWebSocket {
  binaryType: BinaryType = "arraybuffer";
  readonly sent: unknown[] = [];
  readyState = 1;

  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  accept() {}

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(code = 1000, reason = "") {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    this.emit("close", { code, reason });
  }

  send(data: unknown) {
    if (this.readyState !== 1) {
      throw new Error("socket is not open");
    }
    this.sent.push(data);
  }

  private emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}
