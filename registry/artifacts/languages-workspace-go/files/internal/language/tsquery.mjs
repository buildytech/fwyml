import { createRequire } from "node:module";
import path from "node:path";

const [verb, root, rel, lineArg, columnArg] = process.argv.slice(2);
if (!verb || !root || !rel) {
  process.stderr.write("usage: tsquery.mjs definition|hover|diagnostics <root> <rel> <line> <column>\n");
  process.exit(2);
}

const require = createRequire(path.join(root, "package.json"));
let ts;
try {
  ts = require("typescript");
} catch {
  process.stderr.write("typescript is not installed in this workspace\n");
  process.exit(3);
}

const configName = ["tsconfig.json", "tsconfig.app.json"].find((name) =>
  ts.sys.fileExists(path.join(root, name)),
);
const configPath = configName
  ? ts.findConfigFile(root, ts.sys.fileExists, configName)
  : undefined;
const fileName = path.resolve(root, rel.replaceAll("\\", "/"));
const line = Number(lineArg) || 1;
const column = Number(columnArg) || 1;

let options = { allowJs: true, target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext };
let fileNames = [fileName];
if (configPath) {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  options = parsed.options;
  fileNames = parsed.fileNames.includes(fileName) ? parsed.fileNames : [...parsed.fileNames, fileName];
}

const program = ts.createProgram(fileNames, options);
const source = program.getSourceFile(fileName);
if (!source) {
  process.exit(0);
}
const pos = ts.getPositionOfLineAndCharacter(source, Math.max(0, line - 1), Math.max(0, column - 1));
const checker = program.getTypeChecker();

function touching(node, offset) {
  if (offset < node.getStart() || offset > node.getEnd()) return undefined;
  let hit = node;
  ts.forEachChild(node, (child) => {
    const inner = touching(child, offset);
    if (inner) hit = inner;
  });
  return hit;
}

const node = touching(source, pos) ?? source;
const symbol = checker.getSymbolAtLocation(node);
const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

if (verb === "diagnostics") {
  const diags = [
    ...program.getSyntacticDiagnostics(source),
    ...program.getSemanticDiagnostics(source),
  ];
  for (const diag of diags) {
    const start = typeof diag.start === "number" ? diag.start : 0;
    const file = diag.file ?? source;
    const loc = file.getLineAndCharacterOfPosition(start);
    const relPath = path.relative(root, file.fileName).replaceAll("\\", "/");
    const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n").replaceAll("\n", " ");
    process.stdout.write(`${relPath}:${loc.line + 1}:${loc.character + 1}:${message}\n`);
  }
  process.exit(0);
}

if (verb === "hover") {
  const type = checker.getTypeAtLocation(node);
  const name = target ? checker.symbolToString(target) : node.getText();
  const printed = checker.typeToString(type);
  process.stdout.write(`${name}: ${printed}\n`);
  process.exit(0);
}

if (verb === "definition") {
  const decls = target?.getDeclarations() ?? [];
  const decl = decls[0];
  if (!decl) process.exit(0);
  const start = decl.getStart();
  const loc = decl.getSourceFile().getLineAndCharacterOfPosition(start);
  const abs = path.resolve(decl.getSourceFile().fileName);
  process.stdout.write(`${abs}:${loc.line + 1}:${loc.character + 1}\n`);
}

process.exit(0);
