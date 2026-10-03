import type { InterfaceLanguage } from "@t3tools/contracts";
import type * as Electron from "electron";

const LABELS: Readonly<Record<string, string>> = {
  "Check for Updates...": "检查更新…",
  "Settings...": "设置…",
  File: "文件",
  Edit: "编辑",
  "Paste as Text": "粘贴为纯文本",
  Speech: "语音",
  View: "视图",
  "Actual Size": "实际大小",
  "Zoom In": "放大",
  "Zoom Out": "缩小",
};
const ROLES: Readonly<Record<string, string>> = {
  about: "关于 T3 Code",
  services: "服务",
  hide: "隐藏 T3 Code",
  hideOthers: "隐藏其他",
  unhide: "显示全部",
  quit: "退出 T3 Code",
  close: "关闭窗口",
  undo: "撤销",
  redo: "重做",
  cut: "剪切",
  copy: "复制",
  paste: "粘贴",
  delete: "删除",
  selectAll: "全选",
  startSpeaking: "开始朗读",
  stopSpeaking: "停止朗读",
  reload: "重新加载",
  forceReload: "强制重新加载",
  toggleDevTools: "切换开发者工具",
  togglefullscreen: "切换全屏",
  windowMenu: "窗口",
  help: "帮助",
};

export function localizeDesktopMenu(
  template: readonly Electron.MenuItemConstructorOptions[],
  language: InterfaceLanguage,
): Electron.MenuItemConstructorOptions[] {
  if (language === "en") return [...template];
  return template.map((item) => {
    const label =
      item.label !== undefined
        ? (LABELS[item.label] ?? item.label)
        : item.role
          ? ROLES[item.role]
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
