import { spawnSync } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// OpenCodex owns these routes, including context limits and reasoning levels.
// Use its public export rather than copying a model catalog into the T3 profile.
function modelPatch(exported) {
  const config = exported["llm-pi-ai"];
  if (!isObject(config) || !isObject(config.providers))
    throw new Error("OpenCodex export has no llm-pi-ai provider configuration");
  const providers = Object.entries(config.providers);
  if (providers.length === 0) throw new Error("OpenCodex export has no providers");
  for (const [providerId, provider] of providers) {
    if (!isObject(provider) || !Array.isArray(provider.models) || provider.models.length === 0)
      throw new Error(`OpenCodex provider ${providerId} has no models`);
    const ids = new Set();
    for (const model of provider.models) {
      if (!isObject(model) || typeof model.id !== "string" || model.id.length === 0)
        throw new Error(`OpenCodex provider ${providerId} has an invalid model`);
      if (ids.has(model.id)) throw new Error(`OpenCodex provider ${providerId} repeats a model`);
      ids.add(model.id);
    }
  }
  const preferred = providers.find(([, provider]) =>
    provider.models.some((model) => model.id === "gpt-6.1-sol"),
  );
  const [providerId, provider] =
    preferred ?? providers.find(([id]) => id === "opencodex") ?? providers[0];
  const modelId = preferred ? "gpt-6.1-sol" : provider.models[0].id;
  if (!preferred)
    console.error(`T3 DSH: gpt-6.1-sol is absent from OpenCodex; using ${providerId}/${modelId}`);
  return [
    { id: "llm-pi-ai", config },
    { id: "llm-deepseek", disabled: true },
    { id: "llm-deepseek-account", disabled: true },
    { id: "agent-default-model", config: { provider: providerId, model: modelId } },
    { id: "acp", config: { provider: providerId, model: modelId } },
    { id: "t3-acp-bridge", config: { provider: providerId, model: modelId } },
  ];
}

try {
  const result = spawnSync("ocx", ["export", "--client", "dsh", "--json"], {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  // Do not fall back to the old cache: that would make a stale catalog look synced.
  if (result.error || result.status !== 0)
    throw new Error(`ocx export failed (${result.error?.code ?? result.status ?? "interrupted"})`);
  let exported;
  try {
    exported = JSON.parse(result.stdout);
  } catch {
    throw new Error("ocx export returned invalid JSON");
  }
  const patch = modelPatch(exported);
  const patchPath =
    process.env.T3_DSH_MODEL_PATCH ??
    join(
      process.env.DSH_HOME || join(homedir(), ".dsh"),
      "profiles",
      "t3-acp",
      "opencodex.runtime.patch.json",
    );
  await mkdir(dirname(patchPath), { recursive: true });
  const temporaryPath = `${patchPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(patch, null, 2) + "\n", { mode: 0o600 });
  await rename(temporaryPath, patchPath);
  process.stdout.write(patchPath + "\n");
} catch (error) {
  // Export stderr can contain endpoint credentials, so report only our own diagnostic.
  console.error(`T3 DSH model sync failed: ${error.message}`);
  process.exitCode = 1;
}
