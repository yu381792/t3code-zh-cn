import type { InterfaceLanguage } from "@t3tools/contracts/settings";
import { getInterfaceLanguage, translate } from "./translate";
import authoredTemplates from "./authored-ui-templates.json";
// Only authored UI templates are eligible. This does not run on model IDs,
// user input, project names, raw clipboard data, or stored toast objects.
const templates = authoredTemplates
  .map((source) => {
    const literals = source.split(/\{\d+\}/g);
    const slots = [...source.matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1]));
    return { source, literals, slots };
  })
  .filter(
    (template) =>
      template.slots.length > 0 &&
      template.literals.some((text) => /[A-Za-z]/.test(text)) &&
      template.literals.slice(1, -1).every((text) => text.length > 0),
  );
/** Deterministic delimiter matching, with no unbounded backtracking regex. */
function matchTemplate(text: string, template: (typeof templates)[number]): string[] | null {
  const { literals, slots } = template;
  const prefix = literals[0]!;
  const suffix = literals[literals.length - 1]!;
  if (
    !text.startsWith(prefix) ||
    !text.endsWith(suffix) ||
    text.length < prefix.length + suffix.length
  )
    return null;
  const values: string[] = [];
  let cursor = prefix.length;
  const end = text.length - suffix.length;
  for (let i = 0; i < slots.length; i++) {
    const next = i === slots.length - 1 ? end : text.indexOf(literals[i + 1]!, cursor);
    if (next < cursor || next > end) return null;
    const slot = slots[i]!;
    const value = text.slice(cursor, next);
    if (values[slot] !== undefined && values[slot] !== value) return null;
    values[slot] = value;
    cursor = next + literals[i + 1]!.length;
  }
  return cursor === text.length ? values : null;
}
/** Display-only lazy localization. Values remain opaque and are never translated. */
export function translateUiMessage<T>(
  source: T,
  language: InterfaceLanguage = getInterfaceLanguage(),
  allowedSources?: readonly string[],
): T extends string ? string : T {
  if (typeof source !== "string" || language !== "zh-CN")
    return source as T extends string ? string : T;
  const direct =
    allowedSources === undefined || allowedSources.includes(source)
      ? translate(source, language)
      : source;
  if (direct !== source) return direct as T extends string ? string : T;
  for (const template of templates) {
    if (allowedSources !== undefined && !allowedSources.includes(template.source)) continue;
    const values = matchTemplate(source, template);
    if (values)
      return translate(template.source, values, language) as T extends string ? string : T;
  }
  return source as T extends string ? string : T;
}
