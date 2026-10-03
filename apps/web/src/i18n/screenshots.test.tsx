// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import { ProjectDefaultsSettings } from "../components/settings/ProjectDefaultsSettings";
import { ToastProvider, toastManager } from "../components/ui/toast";
import { settingInheritanceLayers } from "../components/settings/SettingInheritance";
import { createLocalApi } from "../localApi";
import { setInterfaceLanguage, translate } from "./translate";
import { translateUiMessage } from "./messages";
import { localizeContextMenuItems, localizedProjectActionLabel } from "./contextMenus";
const state = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn(), useParams: () => ({}) }));
vi.mock("../components/settings/useScopedSettings", () => ({
  useScopedSettings: () => ({ ...DEFAULT_SERVER_SETTINGS, worktreeSubmodules: "recursive" }),
  useScopedSettingsMixed: () => false,
  useScopedSettingSource: () => "environment",
  useUpdateScopedSettings: () => state.update,
}));
vi.mock("../components/settings/SettingsScopeContext", () => ({
  useSettingsScope: () => ({
    scope: { kind: "environment" },
    target: {
      environmentId: "test",
      settings: { ...DEFAULT_SERVER_SETTINGS, worktreeSubmodules: "recursive" },
    },
    targets: [],
    connectedEnvironments: [{}],
  }),
}));
vi.mock("../state/environments", () => ({ useEnvironments: () => ({ environments: [] }) }));
vi.mock("../components/settings/settingsLayout", () => ({
  SettingsRow: ({ control }: { control: React.ReactNode }) => <div>{control}</div>,
  SettingsSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SettingResetButton: () => null,
}));
let root: Root;
let container: HTMLDivElement;
const toastIds: ReturnType<typeof toastManager.add>[] = [];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  setInterfaceLanguage("zh-CN");
  state.update.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    for (const id of toastIds.splice(0)) toastManager.close(id);
    root.unmount();
  });
  container.remove();
  delete window.desktopBridge;
  setInterfaceLanguage("en");
  vi.unstubAllGlobals();
});
describe("screenshots: actual product rendering", () => {
  it("translates selected submodules and all popup choices, preserving the selected enum", async () => {
    await act(async () => root.render(<ProjectDefaultsSettings category="general" />));
    const trigger = container.querySelector(
      '[aria-label="' + translate("Worktree submodules") + '"]',
    )!;
    expect(trigger.textContent).toContain("递归初始化");
    await act(async () => trigger.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const choices = [...document.querySelectorAll('[role="option"]')];
    expect(choices.map((n) => n.textContent)).toEqual(["递归初始化", "仅顶层", "跳过"]);
    await act(async () =>
      choices[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(state.update).toHaveBeenCalledWith({ worktreeSubmodules: "none" });
    await act(async () => setInterfaceLanguage("en"));
    expect(trigger.textContent).toContain("Recursive");
  });
  it("renders the exact update toast in Chinese, including secondary and main actions, and hot-switches", async () => {
    const update = vi.fn(),
      settings = vi.fn();
    await act(async () => root.render(<ToastProvider />));
    await act(async () =>
      toastIds.push(
        toastManager.add({
          title: "Updates Available: 2 providers",
          description: "Install the update now or review provider settings.",
          type: "warning",
          actionProps: { children: "Update", onClick: update },
          data: { secondaryActionProps: { children: "Settings", onClick: settings } },
        }),
      ),
    );
    expect(document.querySelector('[data-slot="toast-title"]')?.textContent).toBe(
      "有可用更新：2 个提供方",
    );
    expect(document.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      "现在安装更新，或查看提供方设置。",
    );
    const buttons = [...document.querySelectorAll("button")];
    const settingsButton = buttons.find((n) => n.textContent === "设置")!,
      updateButton = buttons.find((n) => n.textContent === "更新")!;
    expect(settingsButton).toBeDefined();
    expect(updateButton).toBeDefined();
    await act(async () => settingsButton.click());
    expect(settings).toHaveBeenCalledOnce();
    await act(async () => setInterfaceLanguage("en"));
    expect(document.querySelector('[data-slot="toast-title"]')?.textContent).toBe(
      "Updates Available: 2 providers",
    );
  });
  it("renders the exact added-instance toast and keeps provider and instance name unchanged", async () => {
    await act(async () => root.render(<ToastProvider />));
    await act(async () =>
      toastIds.push(
        toastManager.add({
          type: "success",
          title: "Provider instance added",
          description: "Pi instance 'pi' was added.",
        }),
      ),
    );
    expect(document.querySelector('[data-slot="toast-description"]')?.textContent).toBe(
      "已添加 Pi 实例“pi”。",
    );
    expect(translateUiMessage("Pi instance 'High' was added.")).toBe("已添加 Pi 实例“High”。");
  });
  it("passes translated built-in menu labels through the actual desktop bridge and preserves action IDs and user descendants", async () => {
    const showContextMenu = vi.fn().mockResolvedValue("copy-path");
    window.desktopBridge = { showContextMenu } as unknown as NonNullable<
      typeof window.desktopBridge
    >;
    const items = [
      { id: "rename", label: "Rename" },
      { id: "project-settings", label: "Project settings" },
      { id: "copy-path", label: "Copy Path" },
      { id: "delete", label: "Remove" },
      {
        id: "grouping:submenu",
        label: localizedProjectActionLabel("grouping"),
        children: [{ id: "grouping:user", label: "Settings" }],
      },
      { id: "run-script:custom", label: "Rename" },
    ];
    const result = await createLocalApi().contextMenu.show(items, { x: 1, y: 2 });
    expect(result).toBe("copy-path");
    const shown = showContextMenu.mock.calls[0]![0];
    expect(shown.slice(0, 3).map((n: { label: string }) => n.label)).toEqual([
      "重命名",
      "项目设置",
      "复制路径",
    ]);
    expect(shown[4].label).toBe("分组到…");
    expect(localizedProjectActionLabel("delete")).toBe("移除");
    expect(shown[4].children[0].label).toBe("Settings");
    expect(shown[5].label).toBe("Rename");
    expect(items[0]!.label).toBe("Rename");
  });
  it("does not apply unrelated message templates to known IDs, or translate opaque names/URLs", () => {
    expect(
      localizeContextMenuItems([{ id: "copy-path", label: "Pi instance 'pi' was added." }])[0]
        ?.label,
    ).toBe("Pi instance 'pi' was added.");
    expect(translateUiMessage("/Users/yu/High")).toBe("/Users/yu/High");
    expect(translateUiMessage(null)).toBeNull();
  });
  it("translates inheritance enum values but preserves user model names", () => {
    const server = {
      ...DEFAULT_SERVER_SETTINGS,
      worktreeSubmodules: "recursive" as const,
      defaultModelSelection: { ...DEFAULT_SERVER_SETTINGS.defaultModelSelection, model: "High" },
    };
    const target = {
      environmentId: "test",
      projectId: null,
      settings: server,
      sources: { worktreeSubmodules: "environment" },
    } as unknown as Parameters<typeof settingInheritanceLayers>[0];
    const t = (source: string, values?: readonly unknown[]) =>
      translate(source, values ?? "zh-CN", "zh-CN");
    expect(
      settingInheritanceLayers(
        target,
        server as Parameters<typeof settingInheritanceLayers>[1],
        "worktreeSubmodules",
        t,
      ).find((layer) => layer.key === "environment")?.value,
    ).toBe("递归初始化");
    expect(
      settingInheritanceLayers(
        target,
        server as Parameters<typeof settingInheritanceLayers>[1],
        "defaultModelSelection",
        t,
      ).find((layer) => layer.key === "environment")?.value,
    ).toBe("High");
  });
});
