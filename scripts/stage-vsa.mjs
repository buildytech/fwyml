import { mkdirSync, writeFileSync, cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = join(root, "registry", "snapshot");
const artifacts = join(root, "registry", "artifacts");
const records = parse(readFileSync(join(snapshot, "records.yaml"), "utf8"));

for (const record of records.records ?? []) {
  const path = record.source?.path;
  if (!path || !record.ownedFiles?.length) {
    continue;
  }
  const name = path.replace("../artifacts/", "");
  for (const dest of record.ownedFiles) {
    const file = join(artifacts, name, "files", dest);
    if (existsSync(file)) {
      continue;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${record.id}\n${dest}\n`);
  }
}

const staging = process.env.FWYML_VSA_STAGING;
if (staging) {
  mkdirSync(join(staging, "registry"), { recursive: true });
  mkdirSync(join(staging, "artifacts"), { recursive: true });
  cpSync(snapshot, join(staging, "registry"), { recursive: true });
  if (existsSync(artifacts)) {
    cpSync(artifacts, join(staging, "artifacts"), { recursive: true });
  }
  writeFileSync(
    join(staging, "registry", "index.yaml"),
    `schemaVersion: fw.buildy.tech/registry/v0alpha1\nkind: Registry\nmetadata:\n  id: local-vsa-ide\n  status: draft\ninclude:\n  - tools.yaml\n  - records.yaml\n`,
  );
}
