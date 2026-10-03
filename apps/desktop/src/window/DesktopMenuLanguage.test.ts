import { describe, expect, it } from "vite-plus/test";
import { localizeDesktopMenu } from "./DesktopMenuLanguage.ts";

describe("desktop menu language", () => {
  const source = [
    {
      label: "Edit",
      submenu: [
        { role: "copy" as const },
        { label: "Paste as Text", accelerator: "CmdOrCtrl+Shift+V" },
      ],
    },
  ];
  it("shows Chinese native menu text while retaining shortcuts", () => {
    const result = localizeDesktopMenu(source, "zh-CN");
    expect(result[0]?.label).toBe("编辑");
    expect(result[0]?.submenu).toEqual([
      { role: "copy", label: "复制" },
      { label: "粘贴为纯文本", accelerator: "CmdOrCtrl+Shift+V" },
    ]);
  });
  it("can return to the original English menu without altering source state", () => {
    localizeDesktopMenu(source, "zh-CN");
    expect(localizeDesktopMenu(source, "en")).toEqual(source);
    expect(source[0]?.label).toBe("Edit");
  });
  it("keeps unknown product names unchanged", () => {
    expect(localizeDesktopMenu([{ label: "T3 Code" }], "zh-CN")[0]?.label).toBe("T3 Code");
  });
});
