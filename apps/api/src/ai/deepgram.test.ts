import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDeepgramListenUrl,
  createDeepgramListenProxy,
  DeepgramRequestError,
  DeepgramUnavailableError,
} from "./deepgram";

describe("Deepgram voice proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the live dictation URL without using token grants", () => {
    const url = new URL(buildDeepgramListenUrl());

    expect(url.origin).toBe("https://api.deepgram.com");
    expect(url.pathname).toBe("/v1/listen");
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("smart_format")).toBe("true");
    expect(url.searchParams.get("interim_results")).toBe("true");
    expect(url.searchParams.get("punctuate")).toBe("true");
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
});

function webSocketRequest() {
  return new Request("https://open-cook.test/api/ai/voice/listen", {
    headers: { Upgrade: "websocket" },
  });
}
