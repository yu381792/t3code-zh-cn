import en from "./i18n/locales/en.json" with { type: "json" };
import zhCN from "./i18n/locales/zh-CN.json" with { type: "json" };

export const INTERFACE_CATALOGS: Readonly<
  Record<"en" | "zh-CN", Readonly<Record<string, string>>>
> = { en, "zh-CN": zhCN };
export type InterfaceLocale = keyof typeof INTERFACE_CATALOGS;
const DYNAMIC_MESSAGES: readonly [RegExp, string][] = [
  [/^Settled \((\d+)\)$/, "Settled ({0})"],
  [/^Snoozed \((\d+)\)$/, "Snoozed ({0})"],
  [/^Unpin \((\d+)\)$/, "Unpin ({0})"],
  [/^Settle \((\d+)\)$/, "Settle ({0})"],
  [/^Snooze \((\d+)\)$/, "Snooze ({0})"],
  [/^Mark unread \((\d+)\)$/, "Mark unread ({0})"],
  [/^Delete \((\d+)\)$/, "Delete ({0})"],
  [/^Regenerate titles \((\d+)\)$/, "Regenerate titles ({0})"],
  [/^Regenerating… \((\d+)\)$/, "Regenerating… ({0})"],
  [/^Worked for (.+)$/, "Worked for {0}"],
  [/^Model Picker: Jump: (\d+)$/, "Model Picker: Jump: {0}"],
  [/^Thread: Jump: (\d+)$/, "Thread: Jump: {0}"],
];

function translateSource(source: string, language: InterfaceLocale): string {
  const catalog = INTERFACE_CATALOGS[language];
  const direct = Object.hasOwn(catalog, source) ? catalog[source] : undefined;
  if (direct !== undefined) return direct;
  for (const [pattern, key] of DYNAMIC_MESSAGES) {
    const match = pattern.exec(source);
    if (match && Object.hasOwn(catalog, key)) {
      return catalog[key]!.replace(
        /\{(\d+)\}/g,
        (slot, index: string) => match[Number(index) + 1] ?? slot,
      );
    }
  }
  return source;
}

export type TranslationValues = readonly unknown[];

/** Values are substituted after translation and are never translated themselves. */
export function translateInterfaceText(
  source: string,
  languageOrValues: InterfaceLocale | TranslationValues = "en",
  languageOverride?: InterfaceLocale,
): string {
  const values = typeof languageOrValues === "string" ? undefined : languageOrValues;
  const language =
    typeof languageOrValues === "string" ? languageOrValues : (languageOverride ?? "en");
  const translated = translateSource(source, language);
  if (!values) return translated;
  return translated.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const valueIndex = Number(index);
    return valueIndex < values.length ? String(values[valueIndex]) : placeholder;
  });
}
