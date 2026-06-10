#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const promptsPath = resolve(__dirname, "food-asset-prompts.json");

const modelPresets = {
  draft: {
    endpoint: "fal-ai/flux/schnell",
    mode: "image_size",
    background: "chroma",
    description: "Cheap draft pass for prompt/layout testing.",
  },
  quality: {
    endpoint: "fal-ai/nano-banana-pro",
    mode: "image_size",
    background: "neutral",
    description: "Default final pass for warm hand-painted marketing illustrations.",
  },
  "flux-pro": {
    endpoint: "fal-ai/flux-pro/v1.1",
    mode: "dimensions",
    background: "neutral",
    description: "Polished alternate pass with stronger detail and composition.",
  },
  ultra: {
    endpoint: "fal-ai/flux-pro/v1.1-ultra",
    mode: "dimensions",
    background: "neutral",
    description: "High-resolution final pass for hero assets.",
  },
  "flux-2-pro": {
    endpoint: "fal-ai/flux-2-pro",
    mode: "image_size",
    background: "neutral",
    description: "Alternate high-quality FLUX 2 Pro pass.",
  },
  "nano-banana-pro": {
    endpoint: "fal-ai/nano-banana-pro",
    mode: "image_size",
    background: "neutral",
    description:
      "Alternate premium model worth comparing for playful illustration style.",
  },
  "gpt-image-2": {
    endpoint: "fal-ai/openai/gpt-image-2",
    mode: "image_size",
    background: "neutral",
    description: "Alternate premium model for detailed image generation.",
  },
};

function parseArgs(argv) {
  const args = {
    all: false,
    ids: null,
    limit: Number.parseInt(process.env.FOOD_ASSET_LIMIT ?? "8", 10),
    model: null,
    preset: process.env.FAL_MODEL_PRESET?.trim() || null,
    skipAlpha: false,
  };

  for (const arg of argv) {
    if (arg === "--all") {
      args.all = true;
      args.limit = Number.POSITIVE_INFINITY;
      continue;
    }
    if (arg === "--skip-alpha") {
      args.skipAlpha = true;
      continue;
    }
    if (arg.startsWith("--ids=")) {
      args.ids = new Set(
        arg
          .slice("--ids=".length)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.limit = Number.parseInt(arg.slice("--limit=".length), 10);
      continue;
    }
    if (arg.startsWith("--model=")) {
      args.model = arg.slice("--model=".length).trim();
      continue;
    }
    if (arg.startsWith("--preset=")) {
      args.preset = arg.slice("--preset=".length).trim();
    }
  }

  if (!Number.isFinite(args.limit) && !args.all) {
    args.limit = 8;
  }
  return args;
}

function modelConfigFor(args) {
  if (args.model) {
    return {
      background: process.env.FAL_MODEL_BACKGROUND?.trim() || "neutral",
      endpoint: args.model,
      mode: process.env.FAL_MODEL_MODE?.trim() || "image_size",
      preset: "custom",
    };
  }

  const envModel = process.env.FAL_MODEL?.trim();
  if (envModel) {
    return {
      background: process.env.FAL_MODEL_BACKGROUND?.trim() || "neutral",
      endpoint: envModel,
      mode: process.env.FAL_MODEL_MODE?.trim() || "image_size",
      preset: "custom",
    };
  }

  const presetName = args.preset || "quality";
  const preset = modelPresets[presetName];
  if (!preset) {
    throw new Error(
      `Unknown FAL model preset "${presetName}". Choose one of: ${Object.keys(modelPresets).join(", ")}`,
    );
  }

  return { ...preset, preset: presetName };
}

async function loadEnvFile(path) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || process.env[match[1]]) {
      continue;
    }
    process.env[match[1]] = unquoteEnvValue(match[2]);
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function promptForAsset(asset, modelConfig) {
  const qualityDirection =
    modelConfig.preset === "draft"
      ? "Prioritize clean composition and prompt adherence over fine polish."
      : "Prioritize refined painterly detail, cohesive style, clean edges, and production-quality marketing polish.";
  const backgroundDirection =
    modelConfig.background === "chroma"
      ? `Create the asset on a perfectly flat solid ${asset.keyColor} chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation. Keep the subject fully separated from the background with crisp edges and generous padding. Do not use ${asset.keyColor} anywhere in the subject.`
      : "Create the asset on a perfectly plain near-white studio background for background removal. Keep the background as a single simple border-to-border color with no environment, no table, no room, no text, no pattern, and generous padding around the subject. Avoid heavy drop shadows; a very faint contact shadow is acceptable only if it helps the model keep a clean subject edge.";

  return `${asset.prompt}

${qualityDirection}

${backgroundDirection} No watermark.`;
}

function dimensionsFor(asset) {
  switch (asset.imageSize) {
    case "landscape_4_3":
      return { width: 1536, height: 1152 };
    case "portrait_4_3":
      return { width: 1152, height: 1536 };
    case "square_hd":
    default:
      return { width: 1024, height: 1024 };
  }
}

function requestBodyFor(asset, modelConfig) {
  const prompt = promptForAsset(asset, modelConfig);
  const base = {
    prompt,
    guidance_scale: 3.5,
    num_images: 1,
    output_format: "png",
    enable_safety_checker: true,
  };

  if (modelConfig.mode === "dimensions") {
    return {
      ...base,
      ...dimensionsFor(asset),
    };
  }

  return {
    ...base,
    image_size: asset.imageSize ?? "square_hd",
  };
}

async function callFal(asset, modelConfig, falKey) {
  const response = await fetch(`https://fal.run/${modelConfig.endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBodyFor(asset, modelConfig)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `FAL request failed for ${asset.id} on ${modelConfig.endpoint}: ${response.status} ${text}`,
    );
  }
  return response.json();
}

async function download(url, path) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  await mkdir(dirname(path), { recursive: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path, buffer);
}

async function removeChromaKey(inputPath, outputPath, keyColor) {
  const python = process.env.PYTHON ?? "python3";
  const scriptPath = resolve(__dirname, "remove-chroma-key.py");

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      python,
      [
        scriptPath,
        "--input",
        inputPath,
        "--out",
        outputPath,
        "--key-color",
        process.env.FOOD_ASSET_REMOVE_KEY?.trim() || keyColor,
      ],
      { stdio: "inherit" },
    );
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`remove-chroma-key exited with ${code}`));
      }
    });
  });
}

function removeKeyColorFor(asset, modelConfig) {
  const override = process.env.FOOD_ASSET_REMOVE_KEY?.trim();
  if (override) {
    return override;
  }
  return modelConfig.background === "chroma" ? asset.keyColor : "auto-border";
}

async function main() {
  await loadEnvFile(resolve(__dirname, ".env"));
  await loadEnvFile(resolve(repoRoot, ".env.local"));
  await loadEnvFile(resolve(repoRoot, ".env"));

  const falKey = process.env.FAL_KEY?.trim();
  if (!falKey) {
    throw new Error(
      "Missing FAL_KEY. Add it to tools/.env, repo .env, or the process environment.",
    );
  }

  const args = parseArgs(process.argv.slice(2));
  const modelConfig = modelConfigFor(args);
  const outputDir = resolve(
    repoRoot,
    process.env.FOOD_ASSET_OUTPUT_DIR ?? "apps/web/public/marketing-assets",
  );
  const rawDir = resolve(
    repoRoot,
    process.env.FOOD_ASSET_RAW_DIR ?? "artifacts/marketing-assets/raw",
  );
  const publicFormat = process.env.FOOD_ASSET_PUBLIC_FORMAT?.trim() || "webp";
  const reportPath = resolve(outputDir, "generation-report.json");
  const prompts = JSON.parse(await readFile(promptsPath, "utf8"));
  const selected = prompts
    .filter((asset) => !args.ids || args.ids.has(asset.id))
    .slice(0, args.limit);

  if (selected.length === 0) {
    throw new Error("No food assets selected.");
  }

  await mkdir(outputDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    model: modelConfig.endpoint,
    modelPreset: modelConfig.preset,
    modelMode: modelConfig.mode,
    assets: [],
  };

  for (const asset of selected) {
    console.log(`Generating ${asset.id} with ${modelConfig.endpoint}`);
    const result = await callFal(asset, modelConfig, falKey);
    const image = result.images?.[0];
    if (!image?.url) {
      throw new Error(`FAL returned no image URL for ${asset.id}`);
    }

    const rawPath = resolve(rawDir, `${asset.id}.png`);
    const finalPath = resolve(outputDir, `${asset.id}.${publicFormat}`);
    await download(image.url, rawPath);

    let alphaReady = false;
    if (!args.skipAlpha) {
      try {
        await removeChromaKey(
          rawPath,
          finalPath,
          removeKeyColorFor(asset, modelConfig),
        );
        alphaReady = true;
      } catch (error) {
        console.warn(
          `Could not remove chroma key for ${asset.id}; raw source is still saved. ${error.message}`,
        );
      }
    }

    report.assets.push({
      id: asset.id,
      role: asset.role,
      model: modelConfig.endpoint,
      modelPreset: modelConfig.preset,
      requestId: result.request_id ?? result.requestId ?? null,
      seed: result.seed ?? null,
      sourceUrl: image.url,
      rawPath: rawPath.replace(`${repoRoot}/`, ""),
      finalPath: alphaReady ? finalPath.replace(`${repoRoot}/`, "") : null,
      alphaReady,
    });
  }

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${reportPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
