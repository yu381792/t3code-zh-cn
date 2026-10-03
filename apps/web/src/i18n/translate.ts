import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_INTERFACE_LANGUAGE, type InterfaceLanguage } from "@t3tools/contracts/settings";

import { translateInterfaceText, type TranslationValues } from "@t3tools/shared/i18n";

type Listener = () => void;

let currentLanguage: InterfaceLanguage = DEFAULT_INTERFACE_LANGUAGE;
let languageConfigured = false;
const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InterfaceLanguage {
  return currentLanguage;
}

/**
 * Imperatively set the active language. Called by the settings row's
 * subscription once client settings hydrate and whenever the persisted value
 * changes, so non-React modules (search, formatting) can read the same value.
 */
export function setInterfaceLanguage(language: InterfaceLanguage): void {
  if (currentLanguage === language) return;
  currentLanguage = language;
  emitChange();
}

/** Mark the language store as configured so React can skip the default flash. */
export function markInterfaceLanguageConfigured(): void {
  languageConfigured = true;
  emitChange();
}

export function isInterfaceLanguageConfigured(): boolean {
  return languageConfigured;
}

/** Read the active language from non-React formatting and state modules. */
export function getInterfaceLanguage(): InterfaceLanguage {
  return currentLanguage;
}

/** React hook returning the active interface language. */
export function useInterfaceLanguage(): InterfaceLanguage {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Translate an English source string into the active language. Falls back to
 * the source string when no translation exists, so partial dictionaries ship
 * safely.
 */
export type { TranslationValues } from "@t3tools/shared/i18n";
export function translate(
  source: string,
  languageOrValues: InterfaceLanguage | TranslationValues = currentLanguage,
  languageOverride?: InterfaceLanguage,
): string {
  return translateInterfaceText(source, languageOrValues, languageOverride ?? currentLanguage);
}

/** React hook translating interface messages with a stable language-bound callback. */
export function useTranslate() {
  const language = useInterfaceLanguage();
  return useCallback(
    <T>(source: T, values?: TranslationValues): T extends string ? string : T => {
      // Structured React content and absent labels pass through unchanged.
      return (
        typeof source === "string" ? translate(source, values ?? language, language) : source
      ) as T extends string ? string : T;
    },
    [language],
  );
}
