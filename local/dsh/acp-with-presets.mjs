import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";

// Resolve from the running DSH installation so this extension shares its SDK
// and services instead of loading another copy from the T3 workspace.
const require = createRequire(realpathSync(process.argv[1]));
const acp = await import(pathToFileURL(require.resolve("@deepseek-ai/dsh-acp")).href);
const { ndJsonStream } = await import(
  pathToFileURL(require.resolve("@agentclientprotocol/sdk")).href
);
const { isBuiltInPreset } = await import(
  pathToFileURL(require.resolve("@deepseek-ai/dsh-agent-preset-registry/display")).href
);
export const name = "acp-with-presets";
export const Config = acp.Config;
export const inject = [...acp.inject, "agentPresets", "sessionProjections", "tokenMeter"];
export const PRESET_CONFIG_ID = "agent_preset";

export function apply(ctx, config) {
  const transport =
    config.stream ?? ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
  const writer = transport.writable.getWriter();
  const requests = new Map();
  const sessionOptions = new Map();
  const reasoningByModel = new Map();
  async function presetOption(sessionId) {
    const agent = ctx.agents.get(sessionId);
    const allPresets = await ctx.agentPresets.list();
    if (process.env.T3_DSH_VERIFY_PRESET === "1")
      for (const preset of allPresets.filter((preset) => preset.broken))
        console.error(`DSH preset unavailable: ${preset.id}: ${preset.broken}`);
    const roster = allPresets.filter((preset) => !preset.broken && !isBuiltInPreset(preset));
    const current = agent ? ctx.agentPresets.composedPreset(agent.ctx) : ctx.agentPresets.defaultId;
    return {
      id: PRESET_CONFIG_ID,
      name: "预设",
      type: "select",
      currentValue: current,
      description: "第一条消息发送前可选择；开始对话后固定。",
      options: roster.map((preset) => ({
        value: preset.id,
        name: preset.name ?? preset.id,
        ...(preset.description ? { description: preset.description } : {}),
      })),
    };
  }
  async function enrich(sessionId, options) {
    const next = [
      ...options.filter((option) => option.id !== PRESET_CONFIG_ID),
      await presetOption(sessionId),
    ];
    const shared = next.filter(
      (option) => option.category !== "model" && option.category !== "thought_level",
    );
    for (const option of next.filter((option) => option.category === "model")) {
      for (const group of option.options) {
        for (const model of "value" in group ? [group] : group.options) {
          if (!reasoningByModel.has(model.value)) {
            const [provider, modelId] = JSON.parse(model.value);
            const info = await ctx.llm.resolveModelInfo(provider, modelId);
            reasoningByModel.set(model.value, info.reasoning);
          }
          const reasoning = reasoningByModel.get(model.value);
          const controls = shared.map((control) => ({
            id: control.id,
            label: control.name,
            type: control.type,
            options: control.options.map((choice) => ({ id: choice.value, label: choice.name })),
            ...(control.currentValue ? { currentValue: control.currentValue } : {}),
          }));
          const liveReasoning =
            model.value === option.currentValue
              ? next.find((control) => control.category === "thought_level")?.currentValue
              : undefined;
          const currentEffort = liveReasoning ?? reasoning?.defaultEffort;
          if (reasoning)
            controls.unshift({
              id: "reasoning_effort",
              label: "Reasoning effort",
              type: "select",
              options: reasoning.efforts.map((effort) => ({
                id: String(effort.id),
                label: effort.id === "xhigh" ? "Extra High" : effort.name,
              })),
              ...(currentEffort ? { currentValue: String(currentEffort) } : {}),
            });
          model._meta = { ...model._meta, "t3code/config-options": controls };
        }
      }
    }
    sessionOptions.set(sessionId, next);
    return next;
  }
  const incoming = new TransformStream({
    async transform(packet, controller) {
      if (
        packet.method === "session/set_config_option" &&
        packet.params?.configId === PRESET_CONFIG_ID
      ) {
        const { sessionId, value } = packet.params;
        try {
          const agent = ctx.agents.get(sessionId);
          if (!agent) throw new Error("Unknown DSH session");
          // Reapplying the persisted selection during resume is a no-op. A
          // different selection goes through DSH's authoritative blank check.
          if (ctx.agentPresets.composedPreset(agent.ctx) !== value)
            await ctx.agentPresets.select(agent, value);
          await ctx.sessions.flush(agent.session);
          const configOptions = await enrich(sessionId, sessionOptions.get(sessionId) ?? []);
          await writer.write({ jsonrpc: "2.0", id: packet.id, result: { configOptions } });
        } catch (error) {
          await writer.write({
            jsonrpc: "2.0",
            id: packet.id,
            error: { code: -32602, message: String(error.message ?? error) },
          });
        }
        return;
      }
      if (packet.id !== undefined && packet.method) requests.set(packet.id, packet);
      controller.enqueue(packet);
    },
  });
  acp.apply(ctx, {
    ...config,
    stream: {
      readable: transport.readable.pipeThrough(incoming),
      writable: new WritableStream({
        async write(packet) {
          const request = packet.id === undefined ? undefined : requests.get(packet.id);
          if (request) requests.delete(packet.id);
          const sessionId =
            packet.result?.sessionId ?? request?.params?.sessionId ?? packet.params?.sessionId;
          if (sessionId && packet.result?.configOptions)
            packet = {
              ...packet,
              result: {
                ...packet.result,
                configOptions: await enrich(sessionId, packet.result.configOptions),
              },
            };
          if (sessionId && packet.params?.update?.sessionUpdate === "config_option_update")
            packet = {
              ...packet,
              params: {
                ...packet.params,
                update: {
                  ...packet.params.update,
                  configOptions: await enrich(sessionId, packet.params.update.configOptions),
                },
              },
            };
          if (request?.method === "session/close" && !packet.error)
            sessionOptions.delete(sessionId);
          await writer.write(packet);
        },
        close: () => writer.close(),
        abort: (reason) => writer.abort(reason),
      }),
    },
  });
}
