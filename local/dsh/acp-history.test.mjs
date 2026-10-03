import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationItems, conversationSummary, readHistory, userText } from "./acp-history.mjs";
const header = { id: "saved", createdAt: 1791042164816 };
const events = [
  {
    type: "user/message",
    seq: 1,
    time: 1791042164817,
    surfaceOp: "append",
    data: { source: { kind: "user" }, content: [{ type: "text", text: "以前的用户消息" }] },
  },
  {
    type: "user/message",
    seq: 2,
    time: 1791042164818,
    surfaceOp: "append",
    data: { source: { kind: "system" }, content: [{ type: "text", text: "系统说明不显示" }] },
  },
  { type: "session/title", seq: 3, time: 1791042164819, data: { title: "原对话标题" } },
  {
    type: "assistant/message",
    seq: 4,
    time: 1791042164820,
    surfaceOp: "append",
    data: { message: { content: [{ type: "text", text: "以前的助手回答" }] } },
  },
  {
    type: "assistant/message",
    seq: 5,
    time: 1791042164821,
    surfaceOp: "replace",
    data: { message: { content: [{ type: "text", text: "压缩副本不重复显示" }] } },
  },
];
test("replays original messages in order and hides synthetic/replacement content", () => {
  const items = conversationItems(header.id, events);
  assert.deepEqual(
    items.map((x) => [x.type, x.text]),
    [
      ["user_message", "以前的用户消息"],
      ["assistant_message", "以前的助手回答"],
    ],
  );
  assert.equal(items[0].id, "dsh:saved:1");
});
test("uses stored title, actual activity date and prompt preview; hides empty probes", () => {
  assert.deepEqual(conversationSummary(header, events), {
    title: "原对话标题",
    preview: "以前的用户消息",
    updatedAt: new Date(1791042164821).toISOString(),
  });
  assert.equal(conversationSummary(header, []), undefined);
  assert.equal(
    userText(
      "<t3_code_instructions>系统</t3_code_instructions><user_request>真正的提问</user_request><runtime_info>runtime</runtime_info>",
    ),
    "真正的提问",
  );
});
test("historical tool result keeps the matching call and output", () => {
  const items = conversationItems("saved", [
    {
      type: "tool/call",
      seq: 1,
      data: { callId: "call", name: "bash", arguments: '{"command":"pwd"}' },
    },
    {
      type: "tool/result",
      seq: 2,
      data: {
        message: { toolCallId: "call", isError: false, content: [{ type: "text", text: "/work" }] },
      },
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "completed");
  assert.equal(items[0].detail.output[0].text, "/work");
});
test("history reads never claim write ownership and close on failure", async () => {
  let closed = false;
  await assert.rejects(
    readHistory(
      {
        open: async (id, mode) => {
          assert.equal(mode, "read");
          return {
            header,
            read: async () => {
              throw new Error("bad log");
            },
            close: async () => {
              closed = true;
            },
          };
        },
      },
      "saved",
    ),
    /bad log/,
  );
  assert.equal(closed, true);
});
