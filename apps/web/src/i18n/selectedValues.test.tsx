// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Select, SelectTrigger, SelectValue } from "../components/ui/select";
import { BranchToolbarEnvModeSelector } from "../components/BranchToolbarEnvModeSelector";
import { BranchNamingSettings } from "../components/settings/BranchNamingSettings";
import { buildTraitsTriggerDisplay } from "../components/chat/TraitsPicker";
import {
  ProviderDriverKind,
  DEFAULT_SERVER_SETTINGS,
  type ProviderOptionDescriptor,
} from "@t3tools/contracts";
import { setInterfaceLanguage, translate, useTranslate } from "./translate";

vi.mock("../components/settings/useScopedSettings", () => ({
  useScopedSettings: () => ({
    ...DEFAULT_SERVER_SETTINGS,
    defaultThreadEnvMode: "local",
    branchNamingMode: "static",
  }),
  useScopedSettingsMixed: () => false,
  useUpdateScopedSettings: () => vi.fn(),
}));
vi.mock("../components/settings/SettingsScopeContext", () => ({
  useSettingsScope: () => ({ targets: [], category: "general" }),
}));
vi.mock("../components/settings/useEffectiveScopedSettings", () => ({
  useEffectiveScopedSettings: () => ({ ...DEFAULT_SERVER_SETTINGS, defaultThreadEnvMode: "local" }),
}));
vi.mock("../components/settings/settingsLayout", () => ({
  SettingsRow: ({ control }: { control: React.ReactNode }) => <div>{control}</div>,
  SettingResetButton: () => null,
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setInterfaceLanguage("zh-CN");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  setInterfaceLanguage("en");
  vi.unstubAllGlobals();
});
function SortExample() {
  const t = useTranslate();
  return (
    <Select value="updated_at">
      <SelectTrigger>
        <SelectValue>{t("Last user message")}</SelectValue>
      </SelectTrigger>
    </Select>
  );
}
describe("dynamic selected-value localization", () => {
  it("renders the real workspace selector in Chinese and hot-switches", async () => {
    await act(async () =>
      root.render(
        <BranchToolbarEnvModeSelector
          envLocked={false}
          effectiveEnvMode="local"
          activeWorktreePath={null}
          onEnvModeChange={() => {}}
        />,
      ),
    );
    expect(container.querySelector('[data-slot="select-value"]')?.textContent).toBe("当前检出");
    await act(async () => setInterfaceLanguage("en"));
    expect(container.querySelector('[data-slot="select-value"]')?.textContent).toBe(
      "Current checkout",
    );
  });
  it("does not translate a user workspace whose name matches a dictionary key", async () => {
    await act(async () =>
      root.render(
        <BranchToolbarEnvModeSelector
          displayMode="panel"
          envLocked={false}
          effectiveEnvMode="local"
          activeWorktreePath={null}
          workspaceRoot="/tmp/Save"
          onEnvModeChange={() => {}}
        />,
      ),
    );
    expect(container.querySelector('[data-slot="select-value"]')?.textContent).toBe("Save");
  });
  it("translates the selected project-order label rather than only its menu", async () => {
    await act(async () => root.render(<SortExample />));
    expect(container.querySelector('[data-slot="select-value"]')?.textContent).toBe("最近用户消息");
    expect(container.querySelector("input")?.value).not.toBe("最近用户消息");
  });
  it("renders the actual branch naming callback in Chinese", async () => {
    await act(async () => root.render(<BranchNamingSettings />));
    expect(container.querySelector('[data-slot="select-value"]')?.textContent).toBe("固定前缀");
  });
  it("translates individual trait parts while retaining descriptor values", () => {
    const descriptors: ProviderOptionDescriptor[] = [
      {
        id: "reasoningEffort",
        label: "Reasoning effort",
        type: "select",
        options: [{ id: "high", label: "High" }],
        currentValue: "high",
      },
    ];
    const before = JSON.stringify(descriptors);
    const result = buildTraitsTriggerDisplay({
      provider: ProviderDriverKind.make("codex"),
      descriptors,
      primarySelectDescriptorId: "reasoningEffort",
      ultrathinkPromptControlled: false,
      translateLabel: (s) => translate(s, "zh-CN"),
    });
    expect(result.label).toBe(translate("High", "zh-CN"));
    expect(result.label).not.toBe("High");
    expect(JSON.stringify(descriptors)).toBe(before);
    expect(
      buildTraitsTriggerDisplay({
        provider: ProviderDriverKind.make("codex"),
        descriptors,
        primarySelectDescriptorId: "reasoningEffort",
        ultrathinkPromptControlled: false,
      }).label,
    ).toBe("High");
  });
});
