import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeProcess from "node:process";
import * as NodeAssert from "node:assert/strict";

// Read-only packaging evidence, not a GUI or live-user-data smoke test.
const app = NodeFS.realpathSync(NodeProcess.argv[2]);
const version = NodeProcess.argv[3];
NodeAssert.ok(
  app.endsWith(".app") && version,
  "Usage: node scripts/verify-desktop-localization.mjs APP.app VERSION",
);
const data = NodeFS.readFileSync(NodePath.join(app, "Contents/Resources/app.asar"));
const headerSize = data.readUInt32LE(4);
const jsonSize = data.readUInt32LE(12);
NodeAssert.equal(data.readUInt32LE(0), 4);
NodeAssert.ok(jsonSize <= headerSize - 8 && headerSize < data.length);
const header = JSON.parse(data.subarray(16, 16 + jsonSize).toString());
const witnesses = {
  selector: [],
  labels: [],
  persistence: [],
  nativeMenu: [],
  clientVersion: [],
  v2Database: [],
  v2Orchestrator: [],
  submoduleMessages: [],
  updateMessages: [],
  instanceMessages: [],
  contextMenuMessages: [],
};
function walk(node, prefix = "") {
  for (const [name, entry] of Object.entries(node.files ?? {})) {
    const path = prefix + name;
    if (entry.files) {
      walk(entry, path + "/");
      continue;
    }
    if (entry.unpacked || entry.link || !/\.[cm]?js$/.test(path)) continue;
    const start = 8 + headerSize + Number(entry.offset);
    NodeAssert.ok(start >= 8 + headerSize && start + entry.size <= data.length);
    const source = data.subarray(start, start + entry.size).toString();
    if (path.startsWith("apps/server/dist/") && !path.includes("/client/")) {
      if (source.includes("statev2.sqlite")) witnesses.v2Database.push(path);
      if (source.includes("ProjectionStoreV2") && source.includes("OrchestratorV2"))
        witnesses.v2Orchestrator.push(path);
    }
    if (path.includes("client/assets/")) {
      if (["递归初始化", "仅顶层", "跳过"].every((text) => source.includes(text)))
        witnesses.submoduleMessages.push(path);
      if (
        source.includes("有可用更新：{0} 个提供方") &&
        source.includes("现在安装更新，或查看提供方设置。")
      )
        witnesses.updateMessages.push(path);
      if (source.includes("已添加 {0} 实例“{1}”。")) witnesses.instanceMessages.push(path);
      if (source.includes("分组到…") && source.includes("复制路径"))
        witnesses.contextMenuMessages.push(path);
      if (
        source.includes("interface-language") &&
        source.includes("onValueChange") &&
        source.includes("interfaceLanguage") &&
        source.includes("zh-CN")
      )
        witnesses.selector.push(path);
      if (source.includes("English") && source.includes("简体中文")) witnesses.labels.push(path);
      if (source.includes("getClientSettings") && source.includes("interfaceLanguage"))
        witnesses.persistence.push(path);
      for (const match of source.matchAll(/APP_VERSION:\s*["'`]([^"'`]+)["'`]/g)) {
        NodeAssert.equal(match[1], version, "Packaged client version mismatch in " + path);
        witnesses.clientVersion.push(path);
      }
    }
    if (
      path.endsWith("desktop/dist-electron/main.cjs") &&
      source.includes("subscribeInterfaceLanguage") &&
      source.includes("interfaceLanguage")
    )
      witnesses.nativeMenu.push(path);
  }
}
walk(header);
for (const [name, paths] of Object.entries(witnesses))
  NodeAssert.ok(paths.length > 0, "Missing packaged localization evidence: " + name);
const feed = NodeFS.readFileSync(NodePath.join(app, "Contents/Resources/app-update.yml"), "utf8");
NodeAssert.match(feed, /owner: yu381792/);
NodeAssert.match(feed, /repo: t3code-zh-cn/);
console.log(
  JSON.stringify(
    {
      version,
      updateRepository: "yu381792/t3code-zh-cn",
      witnesses,
      status: "PASS",
      guiVisualTest: "not performed",
    },
    null,
    2,
  ),
);
