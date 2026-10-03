export const name = "verify-t3-preset";
export const inject = ["tools", "agentPresets", "permissionPresets"];

export function apply(ctx) {
  ctx.on("agent/created", async ({ agent, signal }) => {
    const names = ctx.tools.schemas(agent).map((tool) => tool.name);
    if (!names.includes("run_code") || !names.includes("bash"))
      throw new Error("PI-BOTH tools missing");
    const result = await ctx.tools.execute({
      callId: "t3-preset-verification",
      name: "run_code",
      agent,
      arguments: {
        description: "Verify the PI-BOTH execution runtime",
        code: "console.log('PI_BOTH_OK')",
      },
      signal: signal ?? new AbortController().signal,
    });
    if (result.isError || !JSON.stringify(result).includes("PI_BOTH_OK"))
      throw new Error(JSON.stringify(result));
    console.error(
      "PI-BOTH runtime verified: " +
        JSON.stringify({
          preset: ctx.agentPresets.composedPreset(agent.ctx),
          permission: ctx.permissionPresets.current(agent.session),
          nativeBash: true,
          runCode: true,
          result: result.content,
        }),
    );
  });
}
