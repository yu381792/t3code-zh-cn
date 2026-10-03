// ACP has no preset selector yet. Bind the T3 profile's configured default
// before the agent loop starts, and retain its recorded preset on resume.
export const name = "t3-runtime-preset";
export const inject = ["agentPresets", "sessionProjections"];

export function apply(ctx) {
  ctx.on("agent/created", async ({ agent }) => {
    const recorded = ctx.sessionProjections.stateOf(agent.session, "agentPreset");
    const selected = recorded ?? ctx.agentPresets.defaultId;
    const preset = await ctx.agentPresets.mount(agent.ctx, selected);
    if (recorded !== preset.id)
      agent.session.append("agent-preset/selected", { agentPreset: preset.id });
    if (process.env.T3_DSH_VERIFY_PRESET === "1") {
      console.error(`T3 DSH preset applied: ${preset.id}`);
    }
  });
}
