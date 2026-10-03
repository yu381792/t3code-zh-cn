import { translateInterfaceText } from "@t3tools/shared/i18n";
import type { InterfaceLanguage } from "@t3tools/contracts";
import type * as Electron from "electron";

const ROLES: Readonly<Record<string, string>> = {
  about: "About T3 Code",
  services: "Services",
  hide: "Hide T3 Code",
  hideOthers: "Hide Others",
  unhide: "Show All",
  quit: "Quit T3 Code",
  close: "Close Window",
  undo: "Undo",
  redo: "Redo",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  delete: "Delete",
  selectAll: "Select All",
  startSpeaking: "Start Speaking",
  stopSpeaking: "Stop Speaking",
  reload: "Reload",
  forceReload: "Force Reload",
  toggleDevTools: "Toggle Developer Tools",
  togglefullscreen: "Toggle Full Screen",
  windowMenu: "Window",
  help: "Help",
};

export function localizeDesktopMenu(
  template: readonly Electron.MenuItemConstructorOptions[],
  language: InterfaceLanguage,
): Electron.MenuItemConstructorOptions[] {
  if (language === "en") return [...template];
  return template.map((item) => {
    const label =
      item.label !== undefined
        ? translateInterfaceText(item.label, language)
        : item.role
          ? translateInterfaceText(ROLES[item.role] ?? "", language) || undefined
          : undefined;
    return {
      ...item,
      ...(label !== undefined ? { label } : {}),
      ...(Array.isArray(item.submenu)
        ? { submenu: localizeDesktopMenu(item.submenu, language) }
        : {}),
    };
  });
}
