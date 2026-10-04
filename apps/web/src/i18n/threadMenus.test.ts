import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  buildDraftActionMenuItems,
  buildThreadActionMenuItems,
  type ThreadActionMenuState,
} from "../components/threadActionMenu.logic";
import { localizeContextMenuItems } from "./contextMenus";
import { setInterfaceLanguage } from "./translate";

const state: ThreadActionMenuState = {
  branch: "feature/High",
  projectFilter: { label: "yu", isActive: false },
  isPinned: false,
  isSettled: false,
  autoSettleEnabled: true,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: {
    settlement: true,
    autoSettleOptOut: true,
    snooze: true,
    pinning: true,
    titleRegeneration: true,
  },
  snoozePresets: [
    { id: "tomorrow", label: "Tomorrow", whenLabel: "09:00", snoozedUntil: "2026-10-04T09:00:00Z" },
  ],
};
afterEach(() => setInterfaceLanguage("en"));
describe("actual thread action menu localization", () => {
  it("localizes the official draft menu without changing actions or flags", () => {
    const original = buildDraftActionMenuItems({
      hasPath: true,
      hasBranch: true,
      hasProject: true,
    });
    const menu = localizeContextMenuItems(original, "zh-CN");
    expect(menu.find((item) => item.id === "discard")?.label).toBe("丢弃草稿");
    expect(menu.find((item) => item.id === "discard")?.destructive).toBe(true);
    expect(menu.find((item) => item.id === "project-settings")?.label).toBe("项目设置");
    expect(menu.find((item) => item.id === "copy")?.children?.map((item) => item.label)).toEqual([
      "路径",
      "分支",
    ]);
    expect(menu.map((item) => item.id)).toEqual(original.map((item) => item.id));
    expect(localizeContextMenuItems(original, "en")).toEqual(original);
  });
  it("localizes screenshot actions and child settings without changing the input or IDs", () => {
    const original = buildThreadActionMenuItems(state);
    const snapshot = JSON.stringify(original);
    const localized = localizeContextMenuItems(original, "zh-CN");
    const label = (id: string) => localized.find((item) => item.id === id)?.label;
    expect(label("pin")).toBe("置顶线程");
    expect(label("settle")).toBe("收档线程");
    expect(label("snooze")).toBe("搁置");
    expect(label("regenerate-title")).toBe("重新生成标题");
    expect(label("filter-by-project")).toBe("按 yu 筛选");
    expect(label("auto-settle")).toBe("自动收档行为");
    const child = localized.find((item) => item.id === "auto-settle")?.children ?? [];
    expect(child.map((item) => item.checked)).toEqual([true, false]);
    expect(child.every((item) => /[\p{Script=Han}]/u.test(item.label))).toBe(true);
    expect(localized.find((item) => item.id === "snooze")?.children?.[0]?.label).toBe(
      "明天（09:00）",
    );
    expect(localized.map((item) => item.id)).toEqual(original.map((item) => item.id));
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("localizes reverse lifecycle states and keeps action flags intact", () => {
    const original = buildThreadActionMenuItems({
      ...state,
      isPinned: true,
      isSettled: true,
      isSnoozed: true,
      isRegeneratingTitle: true,
    });
    const menu = localizeContextMenuItems(original, "zh-CN");
    for (const id of ["unpin", "unsettle", "unsnooze", "regenerate-title"])
      expect(menu.find((item) => item.id === id)?.label).toMatch(/[\p{Script=Han}]/u);
    expect(menu.find((item) => item.id === "regenerate-title")?.disabled).toBe(true);
    expect(menu.find((item) => item.id === "delete")?.destructive).toBe(true);
  });
  it("preserves opaque project and branch names even when they are translation keys", () => {
    const menu = localizeContextMenuItems(
      buildThreadActionMenuItems({ ...state, projectFilter: { label: "High", isActive: false } }),
      "zh-CN",
    );
    expect(menu.find((item) => item.id === "filter-by-project")?.label).toBe("按 High 筛选");
    expect(menu.find((item) => item.id === "new-thread-on-branch")?.label).toContain(
      "feature/High",
    );
    const active = localizeContextMenuItems(
      buildThreadActionMenuItems({ ...state, projectFilter: { label: "High", isActive: true } }),
      "zh-CN",
    );
    expect(active.find((item) => item.id === "filter-by-project")?.label).toBe("显示所有项目");
  });
  it("leaves English menus and arbitrary custom labels unchanged", () => {
    const original = buildThreadActionMenuItems(state);
    expect(localizeContextMenuItems(original, "en")).toEqual(original);
    expect(
      localizeContextMenuItems([{ id: "custom:pin", label: "Pin thread" }], "zh-CN")[0]?.label,
    ).toBe("Pin thread");
  });
});
