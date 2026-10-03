import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
const child = spawn(new URL("./t3-dsh-acp", import.meta.url).pathname, [], {
  cwd: "/Users/yu",
  stdio: ["pipe", "pipe", "pipe"],
});
let nextId = 0;
const pending = new Map();
let answer = "";
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr = (stderr + chunk).slice(-3000);
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
  const session = await request("session/new", { cwd: "/Users/yu", mcpServers: [] });
  console.log(
    "session/new:",
    JSON.stringify({ sessionId: session.sessionId, configOptions: session.configOptions }),
  );
  if (process.argv.includes("--prompt")) {
    const result = await request("session/prompt", {
      sessionId: session.sessionId,
      prompt: [
        {
          type: "text",
          text: "这是安装连通性测试。不要调用任何工具、读写文件或启动任务，只回答 DSH_T3_OK。",
        },
      ],
    });
    console.log("session/prompt:", JSON.stringify({ stopReason: result.stopReason, answer }));
    if (!answer.includes("DSH_T3_OK")) throw new Error("Expected marker absent");
  }
} catch (error) {
  console.error(error.message);
  console.error(stderr.replace(/Bearer\s+\S+/g, "Bearer [redacted]"));
  process.exitCode = 1;
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  child.stdin.end();
}
