import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

const ids = new Set([
  "explorer-workspace-tree",
  "ui-ui8kit-solid",
  "editor-editory-solid",
  "editor-textarea-solid",
  "workshop-shell-solid",
  "browser-surface-solid",
  "agent-chat-surface-solid",
  "editor-surface-solid",
  "explorer-surface-solid",
  "terminal-surface-solid",
  "assistant-shell-solid",
  "product-template-desktop",
]);

const notes = {
  "explorer-workspace-tree": "Explorer UI is a ui8kit widget. Workspace.ListTree stays in the workspace module. No compose file copy.",
  "ui-ui8kit-solid": "Bricks install via ui8kit add from @ui8kit/registry. Not a fwyml file warehouse.",
  "editor-editory-solid": "Editor document buffer is github.com/fastygo/modules/editor. Screen is ui8kit editor widget.",
  "editor-textarea-solid": "Superseded by the ui8kit editor widget. No owned textarea files.",
  "workshop-shell-solid": "Install via ui8kit add from fastygo/wails solid/r/layouts/workshop-shell.json.",
  "browser-surface-solid": "Install via ui8kit add from fastygo/wails solid/r/widgets/browser.json.",
  "agent-chat-surface-solid": "Install via ui8kit add from fastygo/wails solid/r/widgets/agent-chat.json.",
  "editor-surface-solid": "Install via ui8kit add from fastygo/wails solid/r/widgets/editor.json.",
  "explorer-surface-solid": "Install via ui8kit add from fastygo/wails solid/r/widgets/explorer.json.",
  "terminal-surface-solid": "Install via ui8kit add from fastygo/wails solid/r/widgets/terminal.json.",
  "assistant-shell-solid": "Install via ui8kit add from fastygo/wails solid/r/layouts/assistant-shell.json.",
  "product-template-desktop": "Product go.mod is rendered by fwyml. No owned desktop template files.",
};

function unpin(path) {
  const doc = parse(readFileSync(path, "utf8"));
  for (const record of doc.records ?? []) {
    if (!ids.has(record.id)) {
      continue;
    }
    delete record.ownedFiles;
    delete record.removal;
    record.source = record.id === "ui-ui8kit-solid"
      ? { kind: "npm", package: "@ui8kit/registry", ref: "2.0.0" }
      : { kind: "none" };
    if (record.id === "ui-ui8kit-solid") {
      delete record.dependencies;
    }
    record.notes = notes[record.id];
  }
  writeFileSync(path, stringify(doc, { lineWidth: 0 }));
}

for (const path of process.argv.slice(2)) {
  unpin(path);
  process.stdout.write(`unpinned ${path}\n`);
}
