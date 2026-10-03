import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
export function productionSourceFiles(dir) {
  return NodeFS.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? productionSourceFiles(NodePath.join(dir, entry.name))
      : /\.(ts|tsx)$/.test(entry.name) && !/[.]test[.]|[.]d[.]ts$/.test(entry.name)
        ? [NodePath.join(dir, entry.name)]
        : [],
  );
}
export function collectInterfaceCatalogs(root, parse, walk) {
  const rows = new Map();
  const displayFields = new Set([
    "label",
    "title",
    "description",
    "tooltip",
    "placeholder",
    "message",
    "emptyText",
    "pendingLabel",
    "confirmLabel",
    "cancelLabel",
    "expand",
    "collapse",
    "hint",
    "summary",
  ]);
  const targets = [
    ...productionSourceFiles(NodePath.join(root, "apps/web/src")),
    NodePath.join(root, "packages/contracts/src/settings.ts"),
    NodePath.join(root, "packages/shared/src/model.ts"),
  ];
  for (const file of targets) {
    if (/\/i18n\/(?:v2-)?dictionary\.ts$/.test(file)) continue;
    const source = NodeFS.readFileSync(file, "utf8");
    const ast = parse(source);
    function collect(node, role) {
      if (!node) return;
      if (node.type === "StringLiteral" || node.type === "TemplateLiteral") {
        const key =
          node.type === "StringLiteral"
            ? node.value
            : node.quasis
                .map((q, i) => q.value.cooked + (i < node.expressions.length ? "{" + i + "}" : ""))
                .join("");
        if (!/[A-Za-z]/.test(key)) return;
        const row = {
          source: key,
          file: NodePath.relative(root, file),
          line: node.loc.start.line,
          role,
          template: node.type === "TemplateLiteral",
        };
        const existing = rows.get(key);
        if (existing) existing.locations.push(row);
        else rows.set(key, { ...row, locations: [row] });
      } else if (node.type === "ConditionalExpression") {
        collect(node.consequent, role);
        collect(node.alternate, role);
      } else if (node.type === "LogicalExpression") {
        collect(node.left, role);
        collect(node.right, role);
      } else if (
        node.type === "CallExpression" &&
        ["t3T", "translateUi", "translate"].includes(node.callee.name)
      )
        collect(node.arguments[0], role);
    }
    walk(ast, (node, parents) => {
      if (node.type === "ObjectProperty" && displayFields.has(node.key.name ?? node.key.value))
        collect(node.value, "displayField");
      if (
        node.type === "StringLiteral" &&
        parents[0]?.type === "ObjectProperty" &&
        parents[0].value === node &&
        /LABELS|DESCRIPTIONS/.test(
          parents.find((p) => p.type === "VariableDeclarator")?.id?.name ?? "",
        )
      )
        collect(node, "labelMap");
      if (node.type === "TemplateLiteral" && /ProviderUpdate.*(?:logic|Notification)/.test(file))
        collect(node, "provider-notification");
    });
  }
  return { files: targets.length, rows: [...rows.values()] };
}
export function checkInterfaceCatalogs(catalog, dictionary, preservedSources) {
  const errors = [];
  for (const row of catalog.rows) {
    if (Object.hasOwn(preservedSources, row.source)) continue;
    const target = dictionary.get(row.source);
    if (target === undefined)
      errors.push(row.file + ":" + row.line + ": catalog missing dictionary key " + row.source);
    else if (!/[\p{Script=Han}]/u.test(target))
      errors.push(row.file + ":" + row.line + ": catalog has no Chinese translation " + row.source);
  }
  return errors;
}
