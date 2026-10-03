import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeModule from "node:module";
import * as NodeURL from "node:url";

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
for (const name of ["dictionary.ts", "v2-dictionary.ts"]) {
  const seen = new Set();
  const source = NodeFS.readFileSync(NodePath.join(root, "apps/web/src/i18n", name), "utf8");
  walk(parse(source), (node) => {
    if (node.type !== "ObjectProperty" || node.value.type !== "StringLiteral") return;
    const key = node.key.name ?? node.key.value;
    if (seen.has(key)) errors.push(name + ": duplicate key " + key);
    seen.add(key);
    if (!node.value.value.trim()) errors.push(name + ": empty translation " + key);
    dictionary.set(key, node.value.value);
  });
}
const pluralSuffixOmissions = new Map([
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
    else if (node.type === "TemplateLiteral")
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
