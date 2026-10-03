import type { ContextMenuItem } from "@t3tools/contracts";
import type { InterfaceLanguage } from "@t3tools/contracts/settings";
import { getInterfaceLanguage, translate } from "./translate";
import { translateUiMessage } from "./messages";
import labelCatalog from "./context-menu-labels.json";
/** Only a known built-in ID AND its authored label qualify. Dynamic child
 * IDs and script/project/editor names are intentionally not translated. */
export function localizeContextMenuItems<T extends string>(
  items: readonly ContextMenuItem<T>[],
  language: InterfaceLanguage = getInterfaceLanguage(),
): ContextMenuItem<T>[] {
  return items.map((item) => {
    const sources = (labelCatalog as Record<string, readonly string[]>)[item.id] ?? [];

    return {
      ...item,
      label: translateUiMessage(item.label, language, sources),
      ...(item.children ? { children: localizeContextMenuItems(item.children, language) } : {}),
    };
  });
}

const PROJECT_ACTION_LABELS = {
  rename: "Rename",
  grouping: "Group into...",
  "copy-path": "Copy Path",
  delete: "Remove",
} as const;
export function localizedProjectActionLabel(action: keyof typeof PROJECT_ACTION_LABELS): string {
  return translate(PROJECT_ACTION_LABELS[action]);
}
