export const DEEPGRAM_LIVE_SAMPLE_RATE = 16_000;

type AudioBufferLike = {
  getChannelData: (channel: number) => Float32Array;
  numberOfChannels: number;
};

export function downmixToMono(buffer: AudioBufferLike) {
  if (buffer.numberOfChannels <= 1) {
    return buffer.getChannelData(0).slice();
  }

  const frameCount = buffer.getChannelData(0).length;
  const mono = new Float32Array(frameCount);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < frameCount; index += 1) {
      mono[index] = (mono[index] ?? 0) + (samples[index] ?? 0);
    }
  }

  const scale = 1 / buffer.numberOfChannels;
  for (let index = 0; index < frameCount; index += 1) {
    mono[index] = (mono[index] ?? 0) * scale;
  }

  return mono;
}

export class LivePcmEncoder {
  private buffered = new Float32Array(0);
  private position = 0;

  constructor(private readonly targetSampleRate = DEEPGRAM_LIVE_SAMPLE_RATE) {}

  encode(samples: Float32Array, inputSampleRate: number) {
    if (!samples.length) {
      return null;
    }
    if (inputSampleRate <= 0) {
      throw new Error("Input sample rate must be positive.");
    }
    if (inputSampleRate === this.targetSampleRate && this.buffered.length === 0) {
      return float32ToPcm16(samples);
    }

    const combined = concatFloat32(this.buffered, samples);
    if (combined.length < 2) {
      this.buffered = combined;
      return null;
    }

    const ratio = inputSampleRate / this.targetSampleRate;
    const output = new Float32Array(
      Math.max(0, Math.floor((combined.length - 1 - this.position) / ratio) + 1),
    );

    let outputLength = 0;
    let position = this.position;
    while (position + 1 < combined.length) {
      const index = Math.floor(position);
      const fraction = position - index;
      const left = combined[index] ?? 0;
      const right = combined[index + 1] ?? left;
      output[outputLength] = left * (1 - fraction) + right * fraction;
      outputLength += 1;
      position += ratio;
    }

    const consumed = Math.floor(position);
    this.buffered = combined.slice(consumed);
    this.position = position - consumed;

    return outputLength ? float32ToPcm16(output.subarray(0, outputLength)) : null;
  }
}

function concatFloat32(left: Float32Array, right: Float32Array) {
  if (!left.length) {
    return right.slice();
  }
  const combined = new Float32Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

function float32ToPcm16(samples: Float32Array) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    pcm[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return pcm.buffer;
}
