<script lang="ts">
  import Explorer, { type ExplorerNode } from "./surfaces/Explorer.svelte";
  import Editor, { type EditorTab } from "./surfaces/Editor.svelte";
  import Terminal from "./surfaces/Terminal.svelte";
  import Chat from "./surfaces/Chat.svelte";

  type Doc = { path: string; text: string; saved: string };

  const PREVIEW_ROOT = "preview-workspace";

  const PREVIEW_TREE: ExplorerNode[] = [
    {
      path: PREVIEW_ROOT,
      name: PREVIEW_ROOT,
      dir: true,
      children: [
        {
          path: `${PREVIEW_ROOT}/src`,
          name: "src",
          dir: true,
          children: [
            { path: `${PREVIEW_ROOT}/src/App.svelte`, name: "App.svelte" },
            { path: `${PREVIEW_ROOT}/src/main.ts`, name: "main.ts" },
            {
              path: `${PREVIEW_ROOT}/src/lib`,
              name: "lib",
              dir: true,
              children: [{ path: `${PREVIEW_ROOT}/src/lib/host.ts`, name: "host.ts" }],
            },
          ],
        },
        { path: `${PREVIEW_ROOT}/package.json`, name: "package.json" },
        { path: `${PREVIEW_ROOT}/vite.config.ts`, name: "vite.config.ts" },
        { path: `${PREVIEW_ROOT}/svelte.config.js`, name: "svelte.config.js" },
      ],
    },
  ];

  const PREVIEW_FILES: Record<string, string> = {
    [`${PREVIEW_ROOT}/src/App.svelte`]: `<script lang="ts">\n  let message = $state("BuildY preview workspace");\n<\/script>\n\n<main>{message}</main>\n`,
    [`${PREVIEW_ROOT}/src/main.ts`]: `import { mount } from "svelte";\nimport App from "./App.svelte";\n\nmount(App, { target: document.getElementById("app")! });\n`,
    [`${PREVIEW_ROOT}/src/lib/host.ts`]: `export function hasNativeHost() {\n  return typeof window !== "undefined" && !!(window as any).go;\n}\n`,
    [`${PREVIEW_ROOT}/package.json`]: `{\n  "name": "preview-workspace",\n  "private": true,\n  "type": "module"\n}\n`,
    [`${PREVIEW_ROOT}/vite.config.ts`]: `import { defineConfig } from "vite";\nimport { svelte } from "@sveltejs/vite-plugin-svelte";\nexport default defineConfig({ plugins: [svelte()] });\n`,
    [`${PREVIEW_ROOT}/svelte.config.js`]: `import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";\nexport default { preprocess: vitePreprocess() };\n`,
  };

  const initialPath = `${PREVIEW_ROOT}/src/App.svelte`;
  let docs = $state<Record<string, Doc>>({
    [initialPath]: {
      path: initialPath,
      text: PREVIEW_FILES[initialPath],
      saved: PREVIEW_FILES[initialPath],
    },
  });
  let activePath = $state(initialPath);
  let status = $state("Ready — preview workspace (Vite + Svelte 5)");

  let tabs = $derived<EditorTab[]>(
    Object.values(docs).map((doc) => ({
      path: doc.path,
      dirty: doc.text !== doc.saved,
    })),
  );
  let active = $derived(docs[activePath]);

  function openFile(path: string) {
    const text = PREVIEW_FILES[path];
    if (text == null) {
      status = `No preview body for ${path}`;
      return;
    }
    if (!docs[path]) {
      docs = { ...docs, [path]: { path, text, saved: text } };
    }
    activePath = path;
    status = `Opened ${path}`;
  }

  function closeFile(path: string) {
    const next = { ...docs };
    delete next[path];
    docs = next;
    if (activePath === path) {
      const keys = Object.keys(next);
      activePath = keys.at(-1) ?? "";
    }
    status = `Closed ${path}`;
  }

  function onChange(value: string) {
    if (!activePath) return;
    docs = {
      ...docs,
      [activePath]: { ...docs[activePath], text: value },
    };
  }
</script>

<div class="ide-shell" data-ui-runtime="svelte" data-product="ide-svelte-full">
  <header class="ide-titlebar" role="banner">
    <div class="ide-titlebar-brand">
      <strong>BuildY</strong>
      <span class="muted">IDE · Svelte 5 · Wails3</span>
    </div>
    <div class="ide-titlebar-center" title={PREVIEW_ROOT}>{PREVIEW_ROOT}</div>
    <div class="ide-titlebar-actions muted">preview</div>
  </header>

  <div class="ide-workbench" role="main">
    <div class="ide-col ide-col-explorer">
      <Explorer label="Files" nodes={PREVIEW_TREE} selected={activePath} onOpen={openFile} />
    </div>

    <div class="ide-col ide-col-center">
      <Editor
        {tabs}
        {activePath}
        value={active?.text ?? ""}
        onSelect={(path) => (activePath = path)}
        onClose={closeFile}
        {onChange}
      />
      <Terminal title="Terminal" />
    </div>

    <div class="ide-col ide-col-agent">
      <div class="ide-panel-header">Agent</div>
      <div class="ide-agent-body">
        <Chat />
      </div>
    </div>
  </div>

  <footer class="ide-statusbar" role="contentinfo">
    <span>{status}</span>
    {#if activePath}
      <span class="muted">{activePath}</span>
    {/if}
    <span class="muted">UTF-8 · LF · Svelte5 · UI8Kit codegen</span>
  </footer>
</div>
