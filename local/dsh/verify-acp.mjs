import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const cwd = argument("--cwd") ?? "/Users/yu";
const presetProbe = process.argv.includes("--preset-probe");
const patch =
  argument("--patch") ??
  (presetProbe ? new URL("./verify-preset.patch.yml", import.meta.url).pathname : undefined);
const child = spawn(
  new URL("./t3-dsh-acp", import.meta.url).pathname,
  patch ? ["--patch", patch] : [],
  {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  },
);
let nextId = 0;
const pending = new Map();
let answer = "";
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr = (stderr + chunk).slice(-3000);
  if (
    presetProbe ||
    process.env.T3_DSH_VERIFY_PERMISSION === "1" ||
    process.env.T3_DSH_VERIFY_PRESET === "1"
  )
    process.stderr.write(chunk);
});
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  let packet;
  try {
    packet = JSON.parse(line);
  } catch {
    return;
  }
  if (packet.id !== undefined && pending.has(packet.id)) {
    const { resolve, reject, timer } = pending.get(packet.id);
    clearTimeout(timer);
    pending.delete(packet.id);
    if (packet.error) reject(new Error(JSON.stringify(packet.error)));
    else resolve(packet.result);
  } else if (packet.method === "session/update") {
    const update = packet.params.update;
    if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text")
      answer += update.content.text;
  } else if (packet.id !== undefined) {
    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: packet.id,
        error: { code: -32601, message: "Not needed for this smoke test" },
      }) + "\n",
    );
  }
});
function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 90000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
try {
  const init = await request("initialize", {
    protocolVersion: 1,
    clientInfo: { name: "t3-dsh-check", version: "1" },
    clientCapabilities: {},
  });
  console.log(
    "initialize:",
    JSON.stringify({ protocolVersion: init.protocolVersion, capabilities: init.agentCapabilities }),
  );
  const resumeId = argument("--resume");
  const session = await request(resumeId ? "session/resume" : "session/new", {
    cwd,
    mcpServers: [],
    ...(resumeId ? { sessionId: resumeId } : {}),
  });
  const sessionId = resumeId ?? session.sessionId;
  console.log("session/new:", JSON.stringify({ sessionId, configOptions: session.configOptions }));
  const preset = argument("--preset");
  if (preset) {
    const result = await request("session/set_config_option", {
      sessionId,
      configId: "agent_preset",
      value: preset,
    });
    if (
      result.configOptions.find((option) => option.id === "agent_preset")?.currentValue !== preset
    )
      throw new Error("Preset selection did not apply");
    console.log("preset selected:", preset);
  }
  const writeProbe = argument("--write-probe");
  if (writeProbe || process.argv.includes("--prompt")) {
    if (writeProbe && !/^\/[a-zA-Z0-9_./-]+$/.test(writeProbe))
      throw new Error("Invalid probe path");
    const result = await request("session/prompt", {
      sessionId,
      prompt: [
        {
          type: "text",
          text: writeProbe
            ? `这是一次隔离的权限验证。只调用一次 bash 工具执行这条命令：printf DSH_PERMISSION_OK > '${writeProbe}'。不要读写任何其他文件，不要寻求更高权限，不要重试，不要启动子任务。命令成功只回复 WRITE_OK；失败只回复 WRITE_DENIED。`
            : "这是安装连通性测试。不要调用任何工具、读写文件或启动任务，只回答 DSH_T3_OK。",
        },
      ],
    });
    console.log("session/prompt:", JSON.stringify({ stopReason: result.stopReason, answer }));
    if (!writeProbe && !answer.includes("DSH_T3_OK")) throw new Error("Expected marker absent");
    const lockedPreset = argument("--assert-preset-locked");
    if (lockedPreset) {
      let rejected = false;
      try {
        await request("session/set_config_option", {
          sessionId,
          configId: "agent_preset",
          value: lockedPreset,
        });
      } catch (error) {
        if (!error.message.includes("already started")) throw error;
        rejected = true;
      }
      if (!rejected) throw new Error("Started session allowed preset change");
      console.log("started preset switch: correctly rejected");
    }
  }
} catch (error) {
  console.error(error.message);
  console.error(stderr.replace(/Bearer\s+\S+/g, "Bearer [redacted]"));
  process.exitCode = 1;
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  child.stdin.end();
}
