import { afterEach, describe, expect, it } from "vite-plus/test";
import { createElement, useEffect, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ZH_CN_DICTIONARY } from "./dictionary";
import { getInterfaceLanguage, setInterfaceLanguage, translate, useTranslate } from "./translate";
import {
  formatDayAwareTimestamp,
  formatUpcomingTimestamp,
  formatExpiresInLabel,
  formatChatTimestampTooltip,
} from "../timestampFormat";
import { searchableSetting, searchSettings } from "../components/settings/settingsSearch";

afterEach(() => setInterfaceLanguage("en"));

describe("interface localization", () => {
  it("translates representative V2 surfaces", () => {
    for (const key of [
      "Search ACP Registry",
      "ChatGPT account",
      "Scheduled tasks",
      "Pull request",
      "Device tools",
      "Usage breakdown",
      "Could not save file",
    ]) {
      expect(translate(key, "zh-CN")).not.toBe(key);
      expect(translate(key, "en")).toBe(key);
    }
  });
  it("preserves unknown messages and prototype-shaped names", () => {
    for (const key of ["gpt-custom", "/Users/user/repo", "toString", "constructor", "__proto__"])
      expect(translate(key, "zh-CN")).toBe(key);
  });
  it("interpolates after translation without translating user values", () => {
    expect(translate("Open {0}", ["Build"], "zh-CN")).toBe("打开 Build");
    expect(translate("Open {0}", ["$& {1} <script>"], "zh-CN")).toBe("打开 $& {1} <script>");
    expect(translate("Open {0}", ["Build"], "en")).toBe("Open Build");
    expect(translate("unknown {0} {1}", ["x"], "zh-CN")).toBe("unknown x {1}");
  });
  it("hot-switches language without remounting or losing draft state", async () => {
    let mounts = 0;
    const previousActEnvironment = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    function Fixture() {
      const t = useTranslate();
      const [draft] = useState("kept draft");
      useEffect(() => {
        mounts++;
      }, []);
      expect(t(undefined)).toBeUndefined();
      expect(t(null)).toBeNull();
      const child = createElement("code", null, "Save");
      expect(t(child)).toBe(child);
      return createElement("span", null, t("Save") + "|" + draft);
    }
    let renderer: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        setInterfaceLanguage("zh-CN");
        renderer = create(createElement(Fixture));
      });
      expect(getInterfaceLanguage()).toBe("zh-CN");
      expect(renderer!.root.findByType("span").children.join("")).toBe("保存|kept draft");
      await act(async () => {
        setInterfaceLanguage("en");
      });
      expect(renderer!.root.findByType("span").children.join("")).toBe("Save|kept draft");
      await act(async () => {
        setInterfaceLanguage("zh-CN");
      });
      expect(renderer!.root.findByType("span").children.join("")).toBe("保存|kept draft");
      expect(mounts).toBe(1);
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
    }
  });
  it("finds settings in Chinese and English without changing setting IDs", () => {
    expect(searchSettings("语言").map((x) => x.id)).toContain("interface-language");
    expect(searchSettings("language").map((x) => x.id)).toContain("interface-language");
    expect(searchSettings("网络").map((x) => x.id)).toContain("network-access");
    setInterfaceLanguage("zh-CN");
    expect(searchableSetting("interface-language")).toEqual({
      id: "interface-language",
      title: "界面语言",
    });
  });
  it("localizes calendar days while preserving V2 past-reset behavior", () => {
    setInterfaceLanguage("zh-CN");
    const now = new Date(2026, 9, 3, 12, 0).getTime();
    const yesterday = new Date(2026, 9, 2, 10, 0).toISOString();
    const tomorrow = new Date(2026, 9, 4, 10, 0).toISOString();
    expect(formatDayAwareTimestamp(yesterday, "24-hour", now)).toContain("昨天");
    expect(formatUpcomingTimestamp(yesterday, "24-hour", now)).toContain("昨天");
    expect(formatUpcomingTimestamp(tomorrow, "24-hour", now)).toContain("明天");
    expect(formatChatTimestampTooltip(yesterday, "24-hour")).toContain("2026年10月2日");
    expect(formatExpiresInLabel(new Date(now + 72_000).toISOString(), now)).toBe(
      "1分钟 12秒后过期",
    );
  });
  it("keeps dictionary values nonempty", () => {
    expect(Object.keys(ZH_CN_DICTIONARY).length).toBeGreaterThan(3800);
    for (const [key, value] of Object.entries(ZH_CN_DICTIONARY)) {
      expect(value, key).toBeTruthy();
    }
  });
});
