import { describe, expect, it } from "vitest";
import { downmixToMono, LivePcmEncoder } from "./livePcm";

describe("downmixToMono", () => {
  it("averages stereo audio into one mono channel", () => {
    const mono = downmixToMono({
      getChannelData(channel) {
        return channel === 0
          ? new Float32Array([0.2, 0.4, 0.6])
          : new Float32Array([0.6, 0.2, -0.2]);
      },
      numberOfChannels: 2,
    });

    expect(Array.from(mono)).toEqual([
      0.4000000059604645,
      0.30000001192092896,
      0.20000001788139343,
    ]);
  });
});

describe("LivePcmEncoder", () => {
  it("passes through 16 kHz mono audio as PCM16", () => {
    const encoder = new LivePcmEncoder();

    const pcm = encoder.encode(new Float32Array([0, 0.5, -0.5, 1, -1]), 16_000);

    expect(Array.from(new Int16Array(pcm ?? new ArrayBuffer(0)))).toEqual([
      0,
      16384,
      -16384,
      32767,
      -32768,
    ]);
  });

  it("keeps resampling state across chunk boundaries", () => {
    const encoder = new LivePcmEncoder();

    const first = new Int16Array(
      encoder.encode(new Float32Array([0, 0.1, 0.2, 0.3]), 48_000) ?? new ArrayBuffer(0),
    );
    const second = new Int16Array(
      encoder.encode(new Float32Array([0.4, 0.5, 0.6, 0.7]), 48_000) ?? new ArrayBuffer(0),
    );

    expect(Array.from(first)).toEqual([0]);
    expect(Array.from(second)).toEqual([9830, 19660]);
  });
});
