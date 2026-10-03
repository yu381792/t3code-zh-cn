// Read through DSH persistence so legacy formats and compressed logs use its own decoder.
export async function readHistory(persistence, sessionId) {
  const handle = await persistence.open(sessionId, "read");
  try {
    return { header: handle.header, events: (await handle.read()).events };
  } finally {
    await handle.close();
  }
}
export function userText(text) {
  // T3 wraps the actual prompt in these tags; instructions are not conversation text.
  if (text.trimStart().startsWith("<t3_code_instructions>")) {
    const match = text.match(/<user_request>([\s\S]*?)<\/user_request>/);
    if (match) return match[1].trim();
  }
  return text;
}
export function conversationItems(sessionId, events) {
  const items = [];
  const calls = new Map();
  for (const event of events) {
    if (event.surfaceOp && event.surfaceOp !== "append") continue;
    const data = event.data ?? {};
    if (event.type === "tool/call") {
      let input;
      try {
        input = JSON.parse(data.arguments);
      } catch {
        input = data.arguments ?? null;
      }
      const item = {
        type: "tool_call",
        id: `dsh:${sessionId}:tool:${data.callId}`,
        callId: data.callId,
        name: data.name,
        status: "running",
        error: null,
        detail: { type: "unknown", input, output: null },
      };
      calls.set(data.callId, item);
      items.push(item);
      continue;
    }
    if (event.type === "tool/result") {
      const message = data.message ?? {};
      const item = calls.get(message.toolCallId ?? message.source?.callId);
      if (item) {
        item.status = message.isError ? "failed" : "completed";
        item.detail.output = message.content ?? null;
        item.error = message.isError ? (message.content ?? null) : null;
      }
      continue;
    }
    let role, blocks;
    if (event.type === "user/message" && data.source?.kind === "user") {
      role = "user_message";
      blocks = data.content;
    } else if (event.type === "assistant/message") {
      role = "assistant_message";
      blocks = data.message?.content;
    } else continue;
    let text = (blocks ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");
    if (role === "user_message") text = userText(text);
    if (text) items.push({ type: role, id: `dsh:${sessionId}:${event.seq}`, text });
  }
  return items;
}
export function conversationSummary(header, events) {
  const items = conversationItems(header.id, events);
  const prompts = items.filter((item) => item.type === "user_message");
  if (prompts.length === 0) return undefined; // Hide empty capability/catalog probes.
  const titles = events.filter((event) => event.type === "session/title");
  const recorded = titles.at(-1)?.data?.title ?? titles.at(-1)?.data?.name;
  const title =
    recorded && !recorded.startsWith("<t3_code_instructions>")
      ? recorded
      : prompts[0].text.replace(/\s+/g, " ").slice(0, 80);
  let latest = header.createdAt ?? 0;
  for (const event of events) latest = Math.max(latest, event.time ?? 0);
  return {
    title,
    updatedAt: new Date(latest).toISOString(),
    preview: prompts[0].text.replace(/\s+/g, " ").slice(0, 240),
  };
}
export async function enrichSessions(persistence, sessions) {
  const result = [];
  // Only hold one decoded log at a time; large transcripts should not multiply memory.
  for (const entry of sessions) {
    const { header, events } = await readHistory(persistence, entry.sessionId);
    const summary = conversationSummary(header, events);
    if (summary)
      result.push({
        ...entry,
        title: summary.title,
        updatedAt: summary.updatedAt,
        _meta: { ...entry._meta, "dsh/preview": summary.preview },
      });
  }
  return result;
}
