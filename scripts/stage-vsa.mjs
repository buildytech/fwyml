import { mkdirSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = join(root, "registry", "snapshot");

const staging = process.env.FWYML_VSA_STAGING;
if (staging) {
  mkdirSync(join(staging, "registry"), { recursive: true });
  cpSync(snapshot, join(staging, "registry"), { recursive: true });
  writeFileSync(
    join(staging, "registry", "index.yaml"),
    `schemaVersion: fw.buildy.tech/registry/v0alpha1\nkind: Registry\nmetadata:\n  id: local-vsa-ide\n  status: draft\ninclude:\n  - tools.yaml\n  - records.yaml\n`,
  );
}
