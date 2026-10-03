import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeModule from "node:module";
import * as NodeURL from "node:url";

import {
  collectInterfaceCatalogs,
  checkInterfaceCatalogs,
} from "./interface-localization-catalogs.mjs";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const webRequire = NodeModule.createRequire(NodePath.join(root, "apps/web/package.json"));
const compilerRequire = NodeModule.createRequire(webRequire.resolve("@rolldown/plugin-babel"));
const babel = compilerRequire("@babel/core");
const parse = (source) =>
  babel.parseSync(source, {
    babelrc: false,
    configFile: false,
    sourceType: "module",
    parserOpts: { plugins: ["typescript", "jsx"] },
  });
function walk(node, visit, parents = []) {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node, parents);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "tokens", "comments", "errors"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, [node, ...parents]));
    else if (value && typeof value === "object") walk(value, visit, [node, ...parents]);
  }
}
function files(dir) {
  return NodeFS.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(NodePath.join(dir, entry.name))
      : entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
        ? [NodePath.join(dir, entry.name)]
        : [],
  );
}
const dictionary = new Map();
const errors = [];
const localeDir = NodePath.join(root, "packages/shared/src/i18n/locales");
const english = JSON.parse(NodeFS.readFileSync(NodePath.join(localeDir, "en.json"), "utf8"));
const chinese = JSON.parse(NodeFS.readFileSync(NodePath.join(localeDir, "zh-CN.json"), "utf8"));
for (const [key, value] of Object.entries(chinese)) {
  if (typeof value !== "string" || !value.trim())
    errors.push("zh-CN.json: empty translation " + key);
  if (english[key] !== key) errors.push("en.json: missing source " + key);
  dictionary.set(key, value);
}
for (const key of Object.keys(english)) {
  if (!Object.hasOwn(chinese, key)) errors.push("zh-CN.json: missing key " + key);
}
const pluralSuffixOmissions = new Map([
  ["{0} day{1}", ["{1}"]],
  ["{0} item{1}", ["{1}"]],
  ["{0} {1} outdated. Check provider settings for details.", ["{1}"]],
  ["{0} {1} outdated. Review provider settings for details.", ["{1}"]],
  ["Failed to snooze {0} thread{1}", ["{1}"]],
  [
    "That prompt was restored or deleted before {0} image{1} finished saving. Re-attach {2} if you still need {3}.",
    ["{1}", "{3}"],
  ],
  ["{0} {1} a manual update", ["{1}"]],
  [" · {0} favorite{1}", ["{1}"]],
  ["{0} bot comment{1}", ["{1}"]],
  ["{0} queued message{1}", ["{1}"]],
  ["{0} resolved or dismissed comment{1}", ["{1}"]],
  ["{0}{1} results in {2} files", ["{1}"]],
]);
for (const [source, target] of dictionary) {
  const sourceSlots = new Set(source.match(/\{\d+\}/g) ?? []);
  const targetSlots = new Set(target.match(/\{\d+\}/g) ?? []);
  for (const slot of targetSlots)
    if (!sourceSlots.has(slot)) errors.push("Unexpected slot " + slot + " in " + source);
  for (const slot of sourceSlots)
    if (!targetSlots.has(slot) && !pluralSuffixOmissions.get(source)?.includes(slot))
      errors.push("Missing slot " + slot + " in " + source);
}
const catalog = collectInterfaceCatalogs(root, parse, walk);
const preservedSources = JSON.parse(
  NodeFS.readFileSync(
    NodePath.join(root, "apps/web/src/i18n/catalog-preserved-sources.json"),
    "utf8",
  ),
);
errors.push(...checkInterfaceCatalogs(catalog, dictionary, preservedSources));
// A registered right-click action must have real translations, not English placeholders.
const menuCatalog = JSON.parse(
  NodeFS.readFileSync(NodePath.join(root, "apps/web/src/i18n/context-menu-labels.json"), "utf8"),
);
for (const labels of Object.values(menuCatalog))
  for (const source of labels) {
    if (!Object.hasOwn(preservedSources, source) && !dictionary.has(source))
      errors.push("Native menu missing dictionary key " + source);
  }
const authoredTemplates = JSON.parse(
  NodeFS.readFileSync(NodePath.join(root, "apps/web/src/i18n/authored-ui-templates.json"), "utf8"),
);
for (const source of authoredTemplates)
  if (!dictionary.has(source)) errors.push("Authored template missing dictionary key " + source);

const attributes = new Set([
  "title",
  "description",
  "placeholder",
  "label",
  "aria-label",
  "ariaLabel",
  "alt",
  "tooltip",
  "emptyText",
  "emptyStateText",
  "searchPlaceholder",
  "helperText",
  "confirmLabel",
  "cancelLabel",
  "submitLabel",
  "buttonLabel",
  "emptyMessage",
  "message",
  "caption",
  "subtitle",
  "summary",
  "hint",
  "confirmText",
  "cancelText",
]);
const skipTags = new Set(["code", "pre", "Markdown", "CodeBlock", "SyntaxHighlighter", "Terminal"]);
let calls = 0;
let checkedFiles = 0;
for (const file of files(NodePath.join(root, "apps/web/src"))) {
  checkedFiles++;
  const source = NodeFS.readFileSync(file, "utf8");
  const ast = parse(source);
  const location = (node) => NodePath.relative(root, file) + ":" + node.loc.start.line;
  function checkText(node, text) {
    // Protocol commands, URLs and checkout path examples are not prose.
    if (
      [
        "/skill:",
        "https://… or myapp://",
        "https://your-server:5230/pair#token=…",
        "http://localhost:5173",
        "https://api.example.com",
        "https://hub.example.ts.net:8318",
        "/path/to/checkout",
      ].includes(text)
    )
      return;
    if (text.trim() && /[A-Za-z]/.test(text))
      errors.push(location(node) + ": untranslated display literal " + text);
  }
  function displayExpression(node) {
    if (!node) return;
    if (node.type === "StringLiteral") checkText(node, node.value);
    else if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
      if (node.body.type === "BlockStatement") {
        for (const statement of node.body.body)
          if (statement.type === "ReturnStatement") displayExpression(statement.argument);
      } else displayExpression(node.body);
    } else if (
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      node.object.name.endsWith("_LABELS") &&
      node.object.name !== "INTERFACE_LANGUAGE_LABELS"
    ) {
      errors.push(
        location(node) + ": untranslated UI label-map lookup " + source.slice(node.start, node.end),
      );
    } else if (node.type === "TemplateLiteral")
      checkText(node, node.quasis.map((q) => q.value.cooked).join(""));
    else if (node.type === "ConditionalExpression") {
      displayExpression(node.consequent);
      displayExpression(node.alternate);
    } else if (node.type === "LogicalExpression") displayExpression(node.right);
    else if (node.type === "BinaryExpression" && node.operator === "+") {
      displayExpression(node.left);
      displayExpression(node.right);
    }
  }
  walk(ast, (node, parents) => {
    if (node.type === "CallExpression" && ["t3T", "translateUi"].includes(node.callee.name)) {
      calls++;
      if (node.arguments[0]?.type === "StringLiteral" && !dictionary.has(node.arguments[0].value))
        errors.push(location(node) + ": missing dictionary key " + node.arguments[0].value);
    }
    if (node.type === "JSXText") {
      const tag = parents.find((n) => n.type === "JSXElement")?.openingElement.name.name;
      if (!skipTags.has(tag)) checkText(node, node.value.replace(/\s+/g, " ").trim());
    } else if (node.type === "JSXAttribute" && attributes.has(node.name.name)) {
      if (node.value?.type === "StringLiteral") checkText(node.value, node.value.value);
      else if (node.value?.type === "JSXExpressionContainer")
        displayExpression(node.value.expression);
    } else if (node.type === "JSXExpressionContainer" && parents[0]?.type !== "JSXAttribute") {
      const tag = parents.find((n) => n.type === "JSXElement")?.openingElement.name.name;
      if (!skipTags.has(tag)) displayExpression(node.expression);
    }
    if (node.type === "MemberExpression" && node.property?.name === "t3T")
      errors.push(location(node) + ": invalid translation of a member name");
  });
}
console.log(
  JSON.stringify(
    {
      dictionaryKeys: dictionary.size,
      catalogFiles: catalog.files,
      catalogSources: catalog.rows.length,
      checkedFiles,
      translatedDisplayCalls: calls,
      errors: errors.length,
    },
    null,
    2,
  ),
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
