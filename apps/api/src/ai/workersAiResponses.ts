export type WorkersAiBinding = {
  run(model: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export function workersAiResponseObject(
  result: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return (
    objectFromJsonLike(result.response) ??
    objectFromJsonLike(firstChoiceMessageContent(result)) ??
    (isRecord(result) ? result : undefined)
  );
}

export function workersAiResponseText(
  result: Record<string, unknown>,
): string | undefined {
  return (
    textFromJsonLike(result.response) ??
    textFromJsonLike(firstChoiceMessageContent(result))
  );
}

function objectFromJsonLike(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }

  const text = textFromJsonLike(value);
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(stripJsonFence(text)) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function textFromJsonLike(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim();
    return text || undefined;
  }

  if (isRecord(value)) {
    return JSON.stringify(value);
  }

  return undefined;
}

function firstChoiceMessageContent(result: Record<string, unknown>) {
  const choices = result.choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }

  const firstChoice = choices.find(isRecord);
  const message = isRecord(firstChoice?.message) ? firstChoice.message : undefined;
  return message?.content;
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
