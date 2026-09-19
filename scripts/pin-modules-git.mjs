import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

const commit = "85082e7c93742ff0e5fed8ff9151bc4a1f4c552c";
const repository = "https://github.com/buildytech/ide.git";

function folderFromPath(path = "") {
  const match = path.match(/\.modules\/([^/]+)$/);
  return match?.[1];
}

function pin(file) {
  const doc = parse(readFileSync(file, "utf8"));
  let count = 0;
  for (const record of doc.records ?? []) {
    const folder = folderFromPath(record.source?.path ?? "");
    if (!folder) {
      continue;
    }
    record.source = {
      kind: "git",
      repository,
      commit,
      subpath: `.modules/${folder}`,
      module: record.source.module ?? record.go?.module,
      portable: true,
    };
    count += 1;
  }
  writeFileSync(file, stringify(doc, { lineWidth: 0 }));
  process.stdout.write(`${file}: pinned ${count} records to ${commit}\n`);
}

for (const file of process.argv.slice(2)) {
  pin(file);
}
