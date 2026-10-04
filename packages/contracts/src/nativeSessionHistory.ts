import * as Schema from "effect/Schema";
import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";

const identity = { id: TrimmedNonEmptyString, createdAt: Schema.optional(IsoDateTime) };
export const NativeSessionHistoryItem = Schema.Union([
  Schema.Struct({
    ...identity,
    type: Schema.Literals(["user_message", "assistant_message"]),
    text: Schema.String,
  }),
  Schema.Struct({
    ...identity,
    type: Schema.Literal("tool_call"),
    name: TrimmedNonEmptyString,
    status: Schema.Literals(["running", "completed", "failed"]),
    detail: Schema.Struct({ input: Schema.Unknown, output: Schema.Unknown }),
  }),
]);
export type NativeSessionHistoryItem = typeof NativeSessionHistoryItem.Type;
export const NativeSessionHistory = Schema.Struct({
  items: Schema.Array(NativeSessionHistoryItem),
});
export type NativeSessionHistory = typeof NativeSessionHistory.Type;
