// Finds every message key the app asks next-intl for and reports the ones missing from
// packages/i18n/messages/en.json (the parity test keeps es.json in step with it).
//   node scripts/check-messages.mjs          report; exit 1 if anything is missing
//   node scripts/check-messages.mjs --keys   just the missing keys, one per line
//
// It reads src/**/*.{ts,tsx} with the TypeScript parser (no type checking, so it is quick and
// light) and follows a translator from where it is made to where it is called:
//   const t = useTranslations("ns")              const t = await getTranslations("ns")
//   getTranslations({ namespace: "ns" })         const [t, x] = await Promise.all([getTranslations("ns"), ...])
//   const say = (key, v) => t(key, v)            a pass-through wrapper counts as t
//   helper(t) / <Part t={t} />                   the parameter / destructured prop becomes t,
//                                                across files for relative and "@/" imports
// and collects t("key"), t(cond ? "a" : "b"), t(key) where key is a const holding either,
// and t.rich / t.markup / t.raw / t.has("key"). When the call's values are an object literal,
// it also checks the message's ICU arguments ({name}, {count, plural, ...}) are all passed.
//
// Keys it cannot know are listed for a person to check rather than guessed at:
//   t(`prefix.${x}`), t("prefix." + x)   - reported with whether anything under the prefix
//                                          exists; a missing prefix fails unless t.has guards it
//   t(name)                              - reported as dynamic
// A key that t.has() probes may be missing on purpose (it is the fallback check), so a missing
// t.has key is shown but does not fail the run.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const catalog = JSON.parse(readFileSync(join(root, "packages/i18n/messages/en.json"), "utf8"));
const keysOnly = process.argv.includes("--keys");

const HOOKS = new Set(["useTranslations", "getTranslations"]);
const METHODS = new Set(["rich", "markup", "raw", "has"]);

// ---------------------------------------------------------------------------------------------
// Files

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

const files = new Map(); // absolute path -> { sf, scopes, exports, imports }
for (const path of walk(srcDir)) {
  const text = readFileSync(path, "utf8");
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  files.set(path, { sf, scopes: new Map(), exports: new Map(), imports: new Map() });
}

function resolveModule(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(srcDir, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return undefined;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (files.has(candidate)) return candidate;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Bindings. A binding is { kind: "translator", ns: Set } | { kind: "function", fn } |
// { kind: "param", ns: Set } (a translator once ns is non-empty) | { kind: "import", file, name }
// | { kind: "other" }. Objects are mutated in place as translators are discovered.

const isScope = (node) =>
  ts.isSourceFile(node) ||
  ts.isBlock(node) ||
  ts.isModuleBlock(node) ||
  ts.isCaseBlock(node) ||
  ts.isFunctionLike(node) ||
  ts.isForStatement(node) ||
  ts.isForInStatement(node) ||
  ts.isForOfStatement(node) ||
  ts.isCatchClause(node);

function scopeOf(node) {
  for (let n = node.parent; n; n = n.parent) if (isScope(n)) return n;
  return node.getSourceFile();
}

function unwrap(expr) {
  while (
    expr &&
    (ts.isAwaitExpression(expr) ||
      ts.isParenthesizedExpression(expr) ||
      ts.isAsExpression(expr) ||
      ts.isNonNullExpression(expr) ||
      ts.isSatisfiesExpression(expr))
  ) {
    expr = expr.expression;
  }
  return expr;
}

/** The namespace a useTranslations/getTranslations call opens: "" for the root, "?" if unknown. */
function hookNamespace(expr) {
  expr = unwrap(expr);
  if (!expr || !ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression)) return undefined;
  if (!HOOKS.has(expr.expression.text)) return undefined;
  const arg = expr.arguments[0];
  if (!arg) return "";
  if (ts.isStringLiteralLike(arg)) return arg.text;
  if (ts.isObjectLiteralExpression(arg)) {
    const prop = arg.properties.find(
      (p) => p.name && ts.isIdentifier(p.name) && p.name.text === "namespace",
    );
    if (!prop) return "";
    if (ts.isPropertyAssignment(prop) && ts.isStringLiteralLike(prop.initializer)) return prop.initializer.text;
  }
  return "?";
}

function declare(file, scope, name, binding) {
  let names = file.scopes.get(scope);
  if (!names) file.scopes.set(scope, (names = new Map()));
  names.set(name, binding);
  return binding;
}

function isFunctionExpr(expr) {
  return expr && (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr));
}

function hasExport(node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}
function hasDefault(node) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

function declareBindingName(file, scope, name, binding) {
  if (ts.isIdentifier(name)) return declare(file, scope, name.text, binding);
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) declareBindingName(file, scope, element.name, { kind: binding.kind === "param" ? "param" : "other", ns: new Set() });
  }
}

for (const [path, file] of files) {
  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) {
      const scope = scopeOf(node);
      const init = unwrap(node.initializer);
      const ns = hookNamespace(node.initializer);
      if (ts.isIdentifier(node.name) && ns !== undefined) {
        declare(file, scope, node.name.text, { kind: "translator", ns: new Set([ns]) });
      } else if (
        ts.isArrayBindingPattern(node.name) &&
        init &&
        ts.isCallExpression(init) &&
        init.expression.getText() === "Promise.all" &&
        init.arguments[0] &&
        ts.isArrayLiteralExpression(init.arguments[0])
      ) {
        node.name.elements.forEach((element, i) => {
          if (!ts.isBindingElement(element)) return;
          const elementNs = hookNamespace(init.arguments[0].elements[i]);
          if (ts.isIdentifier(element.name) && elementNs !== undefined) {
            declare(file, scope, element.name.text, { kind: "translator", ns: new Set([elementNs]) });
          } else {
            declareBindingName(file, scope, element.name, { kind: "other" });
          }
        });
      } else if (ts.isIdentifier(node.name) && isFunctionExpr(init)) {
        const binding = declare(file, scope, node.name.text, { kind: "function", fn: init });
        const statement = node.parent?.parent;
        if (statement && ts.isVariableStatement(statement) && hasExport(statement)) file.exports.set(node.name.text, binding);
      } else if (ts.isIdentifier(node.name)) {
        // Kept so a key held in a const (const key = cond ? "a" : `b.${x}`) can be followed.
        const isConst = !!(node.parent.flags & ts.NodeFlags.Const);
        declare(file, scope, node.name.text, { kind: "other", init: isConst ? node.initializer : undefined });
      } else {
        declareBindingName(file, scope, node.name, { kind: "other" });
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const binding = declare(file, scopeOf(node), node.name.text, { kind: "function", fn: node });
      if (hasExport(node)) file.exports.set(hasDefault(node) ? "default" : node.name.text, binding);
    } else if (ts.isParameter(node) && node.parent && ts.isFunctionLike(node.parent)) {
      declareBindingName(file, node.parent, node.name, { kind: "param", ns: new Set() });
    } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolveModule(path, node.moduleSpecifier.text);
      const clause = node.importClause;
      if (target && clause) {
        if (clause.name) declare(file, file.sf, clause.name.text, { kind: "import", file: target, name: "default" });
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const spec of clause.namedBindings.elements) {
            const imported = (spec.propertyName ?? spec.name).text;
            declare(file, file.sf, spec.name.text, { kind: "import", file: target, name: imported });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sf);
}

function lookup(file, from, name, seen = new Set()) {
  for (let n = from; n; n = n.parent) {
    if (!isScope(n)) continue;
    const binding = file.scopes.get(n)?.get(name);
    if (!binding) continue;
    if (binding.kind !== "import") return binding;
    const key = `${binding.file}#${binding.name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const target = files.get(binding.file);
    return target?.exports.get(binding.name);
  }
  return undefined;
}

const translatorNs = (binding) =>
  binding && (binding.kind === "translator" || binding.kind === "param") && binding.ns.size > 0 ? binding.ns : undefined;

/** The call a pass-through wrapper forwards to: (key, ...) => t(key, ...). */
function forwardedCall(fn) {
  const first = fn.parameters[0];
  if (!first || !ts.isIdentifier(first.name)) return undefined;
  let body = fn.body;
  if (body && ts.isBlock(body)) {
    const only = body.statements.length === 1 ? body.statements[0] : undefined;
    body = only && ts.isReturnStatement(only) ? only.expression : undefined;
  }
  body = unwrap(body);
  if (!body || !ts.isCallExpression(body) || !ts.isIdentifier(body.expression)) return undefined;
  const arg = body.arguments[0];
  return arg && ts.isIdentifier(arg) && arg.text === first.name.text ? body : undefined;
}

const forwarders = new Set(); // calls inside pass-through wrappers: not "dynamic"

/** Namespaces if `expr` is a translator (a binding, or an inline pass-through wrapper). */
function exprNs(file, expr) {
  expr = unwrap(expr);
  if (!expr) return undefined;
  if (ts.isIdentifier(expr)) return translatorNs(lookup(file, expr, expr.text));
  if (isFunctionExpr(expr)) {
    const call = forwardedCall(expr);
    const ns = call && translatorNs(lookup(file, call, call.expression.text));
    if (ns) forwarders.add(call);
    return ns;
  }
  return undefined;
}

function addAll(target, source) {
  let changed = false;
  for (const value of source) {
    if (!target.has(value)) {
      target.add(value);
      changed = true;
    }
  }
  return changed;
}

function paramBinding(fn, param) {
  const file = files.get(fn.getSourceFile().fileName);
  return file?.scopes.get(fn)?.get(param);
}

// Propagate translators into wrappers, parameters and destructured props until nothing changes.
for (let round = 0, changed = true; changed && round < 20; round++) {
  changed = false;
  for (const file of files.values()) {
    for (const names of file.scopes.values()) {
      for (const binding of names.values()) {
        if (binding.kind !== "function") continue;
        const call = forwardedCall(binding.fn);
        const ns = call && translatorNs(lookup(file, call, call.expression.text));
        if (ns) {
          forwarders.add(call);
          binding.kind = "translator";
          binding.ns = new Set(ns);
          changed = true;
        }
      }
    }
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const callee = lookup(file, node, node.expression.text);
        if (callee?.kind === "function") {
          node.arguments.forEach((arg, i) => {
            const ns = exprNs(file, arg);
            const param = callee.fn.parameters[i];
            if (!ns || !param || !ts.isIdentifier(param.name)) return;
            const binding = paramBinding(callee.fn, param.name.text);
            if (binding?.kind === "param" && addAll(binding.ns, ns)) changed = true;
          });
        }
      }
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ts.isIdentifier(node.tagName)) {
        const callee = lookup(file, node, node.tagName.text);
        const props = callee?.kind === "function" ? callee.fn.parameters[0] : undefined;
        if (props && ts.isObjectBindingPattern(props.name)) {
          for (const attr of node.attributes.properties) {
            if (!ts.isJsxAttribute(attr) || !attr.initializer || !ts.isJsxExpression(attr.initializer)) continue;
            const ns = exprNs(file, attr.initializer.expression);
            if (!ns) continue;
            const element = props.name.elements.find(
              (e) => (e.propertyName ?? e.name).getText() === attr.name.getText() && ts.isIdentifier(e.name),
            );
            const binding = element && paramBinding(callee.fn, element.name.text);
            if (binding?.kind === "param" && addAll(binding.ns, ns)) changed = true;
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file.sf);
  }
}

// ---------------------------------------------------------------------------------------------
// Collect and check

function get(path) {
  return path.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), catalog);
}
const join2 = (ns, key) => (ns ? `${ns}.${key}` : key);

/** Literal keys, or a template prefix, or nothing (dynamic), for the key argument. */
function keyShapes(expr, file, depth = 0) {
  expr = unwrap(expr);
  if (!expr) return [{ dynamic: true }];
  if (ts.isStringLiteralLike(expr)) return [{ key: expr.text }];
  if (ts.isConditionalExpression(expr)) {
    return [...keyShapes(expr.whenTrue, file, depth), ...keyShapes(expr.whenFalse, file, depth)];
  }
  if (ts.isIdentifier(expr) && depth < 3) {
    const binding = lookup(file, expr, expr.text);
    if (binding?.kind === "other" && binding.init) return keyShapes(binding.init, file, depth + 1);
  }
  if (ts.isTemplateExpression(expr)) return [{ prefix: expr.head.text }];
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = unwrap(expr.left);
    if (ts.isStringLiteralLike(left)) return [{ prefix: left.text }];
  }
  return [{ dynamic: true }];
}

/** A message's ICU arguments: a name directly followed by } or , (the parity test's rule, so a
 *  plural branch's words, {# stores}, are not mistaken for one). */
function argumentsOf(message) {
  return [...new Set([...message.matchAll(/\{\s*(\w+)\s*[},]/g)].map((m) => m[1]))];
}

/** The value names a call passes, when they can be read (an object literal, or nothing). */
function passedValues(expr) {
  expr = unwrap(expr);
  if (!expr) return new Set();
  if (!ts.isObjectLiteralExpression(expr)) return undefined;
  const names = new Set();
  for (const prop of expr.properties) {
    if (ts.isSpreadAssignment(prop) || !prop.name) return undefined;
    names.add(ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name) ? prop.name.text : prop.name.getText());
  }
  return names;
}

const unpassed = new Map(); // "key  needs {x}" -> [where]
const missing = new Map(); // full key -> [where]
const guarded = new Map(); // t.has keys that are missing
const notMessage = new Map();
const templates = new Map(); // full prefix -> { where: [], guarded, has }
const dynamic = [];
const unresolved = [];
let used = 0;

const push = (map, key, where) => map.set(key, [...(map.get(key) ?? []), where]);

for (const [path, file] of files) {
  const rel = relative(root, path).split(sep).join("/");
  const hasPrefixes = new Set();
  const hasDynamic = new Set(); // "namespace|argument text" probed with .has(...)
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      let target = node.expression;
      let method = "call";
      if (ts.isPropertyAccessExpression(target) && METHODS.has(target.name.text)) {
        method = target.name.text;
        target = target.expression;
      }
      if (ts.isIdentifier(target)) {
        const ns = translatorNs(lookup(file, node, target.text));
        if (ns) calls.push({ node, ns, method });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sf);

  for (const { node, ns, method } of calls) {
    const { line } = file.sf.getLineAndCharacterOfPosition(node.getStart());
    const where = `${rel}:${line + 1}`;
    for (const namespace of ns) {
      if (namespace === "?") {
        unresolved.push(`${where}  ${node.getText().slice(0, 80)}`);
        continue;
      }
      for (const shape of keyShapes(node.arguments[0], file)) {
        if (method !== "has") continue;
        if (shape.prefix !== undefined) hasPrefixes.add(join2(namespace, shape.prefix));
        if (shape.dynamic) hasDynamic.add(`${namespace}|${node.arguments[0]?.getText()}`);
      }
    }
  }

  for (const { node, ns, method } of calls) {
    const { line } = file.sf.getLineAndCharacterOfPosition(node.getStart());
    const where = `${rel}:${line + 1}`;
    for (const namespace of ns) {
      if (namespace === "?") continue;
      for (const shape of keyShapes(node.arguments[0], file)) {
        if (shape.key !== undefined) {
          used++;
          const full = join2(namespace, shape.key);
          const value = get(full);
          if (value === undefined) push(method === "has" ? guarded : missing, full, where);
          else if (typeof value !== "string" && method !== "has") push(notMessage, full, where);
          else if (typeof value === "string" && method !== "has" && method !== "raw") {
            const passed = passedValues(node.arguments[1]);
            const lacking = passed ? argumentsOf(value).filter((name) => !passed.has(name)) : [];
            if (lacking.length) push(unpassed, `${full}  needs {${lacking.join("}, {")}}`, where);
          }
        } else if (shape.prefix !== undefined) {
          const full = join2(namespace, shape.prefix);
          const entry = templates.get(full) ?? { where: [], guarded: false };
          entry.where.push(where);
          entry.guarded ||= hasPrefixes.has(full);
          templates.set(full, entry);
        } else if (!forwarders.has(node) && !hasDynamic.has(`${namespace}|${node.arguments[0]?.getText()}`)) {
          const group = namespace ? get(namespace) : catalog;
          const present = group && typeof group === "object" ? Object.keys(group) : [];
          const shown = present.slice(0, 10).join(", ") + (present.length > 10 ? ", ..." : "");
          dynamic.push(`${where}  ${node.getText().slice(0, 100)}\n      ${namespace || "(root)"}: ${shown || "NOTHING present"}`);
        }
      }
    }
  }
}

/** What exists under a template prefix: "a.b." -> the keys of a.b; "a.b" -> keys of a starting b. */
function underPrefix(prefix) {
  const cut = prefix.lastIndexOf(".");
  const parent = cut < 0 ? catalog : get(prefix.slice(0, cut));
  const start = prefix.slice(cut + 1);
  if (!parent || typeof parent !== "object") return [];
  return Object.keys(parent).filter((key) => key.startsWith(start));
}

const brokenTemplates = [...templates].filter(([prefix, entry]) => !entry.guarded && underPrefix(prefix).length === 0);

if (keysOnly) {
  for (const key of [...missing.keys()].sort()) console.log(key);
  process.exit(missing.size ? 1 : 0);
}

const list = (map) =>
  [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, where]) => `  ${key}\n      ${[...new Set(where)].join("\n      ")}`)
    .join("\n");

console.log(`Checked ${used} literal keys in ${files.size} files against en.json.\n`);

if (missing.size) console.log(`MISSING from en.json (${missing.size}):\n${list(missing)}\n`);
if (notMessage.size) console.log(`NOT A MESSAGE - the key is a group, not a string (${notMessage.size}):\n${list(notMessage)}\n`);
if (unpassed.size) console.log(`ARGUMENTS the message uses but the call does not pass (${unpassed.size}):\n${list(unpassed)}\n`);
if (unresolved.length) console.log(`UNRESOLVED namespace (${unresolved.length}):\n  ${unresolved.join("\n  ")}\n`);
if (brokenTemplates.length) {
  console.log(`TEMPLATE prefix with nothing under it (${brokenTemplates.length}):`);
  for (const [prefix, entry] of brokenTemplates) console.log(`  ${prefix}*\n      ${entry.where.join("\n      ")}`);
  console.log("");
}

if (templates.size) {
  console.log(`Template keys - check by hand that every value the code can produce exists (${templates.size}):`);
  for (const [prefix, entry] of [...templates].sort(([a], [b]) => a.localeCompare(b))) {
    const found = underPrefix(prefix);
    const status = found.length ? `${found.length} present: ${found.slice(0, 8).join(", ")}${found.length > 8 ? ", ..." : ""}` : "NOTHING present";
    console.log(`  ${prefix}*  ${entry.guarded ? "[t.has-guarded] " : ""}(${status})\n      ${[...new Set(entry.where)].join("\n      ")}`);
  }
  console.log("");
}
if (dynamic.length) console.log(`Dynamic keys not guarded by t.has - check by hand (${dynamic.length}):\n  ${dynamic.join("\n  ")}\n`);
if (guarded.size) console.log(`Probed with t.has and absent - fine if the fallback is intended (${guarded.size}):\n${list(guarded)}\n`);

if (missing.size) {
  const byNs = new Map();
  for (const key of missing.keys()) {
    const ns = key.split(".").slice(0, -1).slice(0, 3).join(".");
    byNs.set(ns, (byNs.get(ns) ?? 0) + 1);
  }
  console.log("Missing by namespace:");
  for (const [ns, count] of [...byNs].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${String(count).padStart(4)}  ${ns}`);
  console.log("");
}

const failed = missing.size + notMessage.size + unpassed.size + unresolved.length + brokenTemplates.length;
console.log(failed ? `FAILED: ${failed} problem(s).` : "OK: every literal key exists in en.json.");
process.exit(failed ? 1 : 0);
