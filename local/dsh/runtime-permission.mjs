// The process is reopened when T3 changes its runtime mode. Reapply the
// selected policy on both fresh and resumed DSH agents so durable session
// defaults cannot override the user's current selection in T3.
export const name = "t3-runtime-permission";
export const inject = ["permissionPresets"];

export function apply(ctx) {
  const mode = process.env.T3_RUNTIME_MODE;
  if (process.env.T3_DSH_VERIFY_PERMISSION === "1")
    console.error(`T3 permission plugin loaded: ${mode}`);
  if (mode === undefined) return;
  if (!["full-access", "approval-required", "auto-accept-edits", "auto"].includes(mode)) {
    throw new Error(`Unsupported T3 runtime mode: ${mode}`);
  }
  const preset = mode === "full-access" ? "danger-full-access" : "workspace-write";
  ctx.on("agent/created", ({ agent }) => {
    ctx.permissionPresets.set(agent.session, preset);
    const actual = ctx.permissionPresets.current(agent.session);
    if (process.env.T3_DSH_VERIFY_PERMISSION === "1")
      console.error(`T3 DSH permission applied: ${actual}`);
    if (actual !== preset) throw new Error(`T3 requested ${preset}, but DSH applied ${actual}`);
  });
}
