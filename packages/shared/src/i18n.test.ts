import { describe, expect, it } from "vite-plus/test";
import { INTERFACE_CATALOGS, translateInterfaceText } from "./i18n.ts";

describe("portable interface language catalogs", () => {
  it("ships matching English and Simplified Chinese source-key catalogs", () => {
    expect(Object.keys(INTERFACE_CATALOGS.en)).toEqual(Object.keys(INTERFACE_CATALOGS["zh-CN"]));
    for (const [source, value] of Object.entries(INTERFACE_CATALOGS.en)) expect(value).toBe(source);
  });
  it("defaults to English and falls back for missing and prototype-like keys", () => {
    expect(translateInterfaceText("Save")).toBe("Save");
    expect(translateInterfaceText("not a known interface message", "zh-CN")).toBe(
      "not a known interface message",
    );
    expect(translateInterfaceText("__proto__", "zh-CN")).toBe("__proto__");
    expect(translateInterfaceText("constructor", "zh-CN")).toBe("constructor");
  });
  it("translates dynamic templates without translating inserted names or IDs", () => {
    expect(
      translateInterfaceText("{0} instance '{1}' was added.", ["Pi", "High"], "zh-CN"),
    ).toContain("High");
    expect(translateInterfaceText("Delete (3)", "en")).toBe("Delete (3)");
    expect(translateInterfaceText("Delete (3)", "zh-CN")).toBe("删除 (3)");
    expect(translateInterfaceText("Model Picker: Jump: 2", "zh-CN")).toBe("模型选择器：跳转：2");
  });
  it("keeps bundled locale catalogs immutable during lookup", () => {
    const before = JSON.stringify(INTERFACE_CATALOGS);
    translateInterfaceText("Delete (9)", "zh-CN");
    expect(JSON.stringify(INTERFACE_CATALOGS)).toBe(before);
  });
});
