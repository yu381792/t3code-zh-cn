import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeModule from "node:module";
import {
  collectInterfaceCatalogs,
  checkInterfaceCatalogs,
} from "./interface-localization-catalogs.mjs";
const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const req = NodeModule.createRequire(NodePath.join(root, "apps/web/package.json"));
const babel = NodeModule.createRequire(req.resolve("@rolldown/plugin-babel"))("@babel/core");
function walk(node, visit, parents = []) {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node, parents);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "comments", "tokens"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, [node, ...parents]));
    else if (value && typeof value === "object") walk(value, visit, [node, ...parents]);
  }
}
const catalog = collectInterfaceCatalogs(
  root,
  (source) =>
    babel.parseSync(source, {
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ["typescript", "jsx"] },
    }),
  walk,
);
NodeTest.test("imported .ts submodule label-map values are audited, not just t3T(member)", () => {
  for (const source of ["Recursive", "Top level only", "Skip"])
    NodeAssert.ok(
      catalog.rows.some(
        (row) => row.source === source && row.file.endsWith("BranchToolbar.logic.ts"),
      ),
    );
});
NodeTest.test("missing and English identity entries fail even when their caller uses t3T", () => {
  const narrow = { rows: catalog.rows.filter((row) => row.source === "Recursive") };
  NodeAssert.match(
    checkInterfaceCatalogs(narrow, new Map(), {}).join("\n"),
    /missing dictionary key Recursive/,
  );
  NodeAssert.match(
    checkInterfaceCatalogs(narrow, new Map([["Recursive", "Recursive"]]), {}).join("\n"),
    /no Chinese translation/,
  );
  NodeAssert.deepEqual(
    checkInterfaceCatalogs(narrow, new Map([["Recursive", "递归初始化"]]), {}),
    [],
  );
});
NodeTest.test(
  "conditional toast messages and pure helper provider titles have recorded provenance",
  () => {
    for (const source of [
      "Install the update now or review provider settings.",
      "Updates Available: {0} providers",
      "{0} instance '{1}' was added.",
    ])
      NodeAssert.ok(catalog.rows.some((row) => row.source === source));
  },
);
