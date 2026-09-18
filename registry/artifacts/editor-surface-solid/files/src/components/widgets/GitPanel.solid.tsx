import { For, Show } from "solid-js";
import { Block, Box, Button, Icon, Text, Textarea } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";
import type { DiffFile, DiffLine } from "$lib/git-diff";
import { previewDiffLines } from "$lib/git-diff";
import { gitPanelError } from "$lib/git-message";
import type { GitFile, GitSnapshot } from "$lib/workbench";

export function GitPanel(props: {
  copy: typeof Copy;
  status: GitSnapshot | null;
  error: string;
  busy: boolean;
  lastResult?: string;
  message: string;
  activePath: string;
  activePatch: DiffFile | null;
  onMessage: (text: string) => void;
  onRefresh: () => void;
  onStage: (path: string) => void;
  onStageAll: () => void;
  onCommit: () => void;
  onUnstage: (path: string) => void;
  onPush: () => void;
  onFetch: () => void;
  onPull: () => void;
  onOpen: (path: string) => void;
}) {
  const staged = () => props.status?.files.filter(file => file.index !== " " && file.index !== "?") ?? [];
  const changed = () => props.status?.files.filter(file => file.worktree !== " ") ?? [];
  const errorText = () => gitPanelError(props.error, {
    identity: props.copy.gitIdentity,
    noRepo: props.copy.gitUnavailable,
    auth: props.copy.gitAuth,
  });
  const canCommit = () => Boolean(props.message.trim() && staged().length && !props.busy);
  const commitHint = () => {
    if (!props.status) return "";
    if (!staged().length) return props.copy.gitCommitNeedStage;
    if (!props.message.trim()) return props.copy.gitCommitNeedMessage;
    return "";
  };
  const kindLabel = (file: GitFile) => {
    if (file.kind === "conflict") return props.copy.gitKindConflict;
    if (file.kind === "deleted") return props.copy.gitKindDeleted;
    if (file.kind === "renamed") return props.copy.gitKindRenamed;
    if (file.kind === "untracked") return props.copy.gitKindUntracked;
    if (file.kind === "added") return props.copy.gitKindAdded;
    if (file.kind === "modified") return props.copy.gitKindModified;
    return file.kind ?? "";
  };
  const preview = (): DiffLine[] => props.activePatch ? previewDiffLines(props.activePatch, 8) : [];
  return (
    <Block tag="aside" class="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label={props.copy.sourceControl}>
      <Box class="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <Text class="min-w-0 truncate text-xs">
          <Icon type="svg" href="/icons.svg#git" /> {props.status?.branch || props.copy.sourceControl}
        </Text>
        <Button variant="ghost" size="icon" class="h-8 w-8" aria-label={props.copy.refresh} disabled={props.busy} onClick={props.onRefresh}>
          <Icon type="svg" href="/icons.svg#refresh" />
        </Button>
      </Box>
      <Box class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
        <Show when={props.status?.upstream}>
          <Text class="text-xs text-muted-foreground">
            {props.copy.gitUpstream} {props.status?.upstream} · {props.copy.gitAhead} {props.status?.ahead ?? 0} · {props.copy.gitBehind} {props.status?.behind ?? 0}
          </Text>
        </Show>
        <Show when={errorText()}>
          <Text role="alert" class="text-xs text-destructive">{errorText()}</Text>
        </Show>
        <Show when={props.lastResult}>
          <Text class="text-xs text-muted-foreground" title={props.lastResult}>{props.lastResult}</Text>
        </Show>
        <Show when={!props.error && !props.status}>
          <Text class="text-xs text-muted-foreground">{props.copy.gitUnavailable}</Text>
        </Show>
        <Show when={props.status}>
          <Box class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={props.busy} onClick={props.onFetch}>{props.copy.fetch}</Button>
            <Button variant="outline" size="sm" disabled={props.busy} onClick={props.onPull}>{props.copy.pull}</Button>
            <Button variant="outline" size="sm" disabled={props.busy} onClick={props.onPush}><Icon type="svg" href="/icons.svg#send" />{props.copy.push}</Button>
          </Box>
          <Textarea
            rows={3}
            class="min-h-20 resize-y text-xs"
            value={props.message}
            aria-label={props.copy.commitMessage}
            placeholder={props.copy.commitMessage}
            onInput={(e: InputEvent & { currentTarget: HTMLTextAreaElement }) => props.onMessage(e.currentTarget.value)}
          />
          <Button size="sm" disabled={!canCommit()} onClick={props.onCommit}>
            <Icon type="svg" href="/icons.svg#check" />{props.copy.commit}
          </Button>
          <Show when={commitHint()}>
            <Text class="text-xs text-muted-foreground">{commitHint()}</Text>
          </Show>
          <Box>
            <Box class="flex items-center justify-between gap-2 px-2 py-2">
              <Text class="text-xs font-semibold">{props.copy.changes} ({changed().length})</Text>
              <Show when={changed().length}>
                <Button variant="ghost" size="sm" class="h-8 px-2 text-xs" disabled={props.busy} onClick={props.onStageAll}>{props.copy.gitStageAll}</Button>
              </Show>
            </Box>
            <For each={changed()}>{file => fileRow(props, file, true, kindLabel(file))}</For>
            <Show when={!changed().length}>
              <Text class="px-2 text-xs text-muted-foreground">{props.copy.gitNoChanges}</Text>
            </Show>
          </Box>
          <Box>
            <Text class="px-2 py-2 text-xs font-semibold">{props.copy.staged} ({staged().length})</Text>
            <For each={staged()}>{file => fileRow(props, file, false, kindLabel(file))}</For>
            <Show when={!staged().length}>
              <Text class="px-2 text-xs text-muted-foreground">{props.copy.gitNoStaged}</Text>
            </Show>
          </Box>
          <Show when={props.activePatch && preview().length}>
            <Box class="rounded-md border border-border bg-background p-2">
              <Text class="mb-2 text-xs text-muted-foreground">{props.copy.gitInEditor} {props.activePatch?.path}</Text>
              <For each={preview()}>{line =>
                <Text class={`font-mono text-xs ${line.kind === "add" ? "text-foreground" : "text-muted-foreground"}`}>
                  {line.kind === "add" ? "+" : "-"}{line.text}
                </Text>
              }</For>
            </Box>
          </Show>
          <Show when={!props.status?.files.length}>
            <Text class="px-2 text-xs text-muted-foreground">{props.copy.clean}</Text>
          </Show>
        </Show>
      </Box>
    </Block>
  );
}

function fileRow(
  props: { copy: typeof Copy; busy: boolean; activePath: string; onOpen: (path: string) => void; onStage: (path: string) => void; onUnstage: (path: string) => void },
  file: GitFile,
  stage: boolean,
  kind: string,
) {
  const label = file.orig ? `${file.orig} → ${file.path}` : file.path;
  return (
    <Box class={`flex items-center ${props.activePath === file.path ? "bg-accent" : ""}`}>
      <Button
        variant="ghost"
        class="h-8 min-w-0 flex-1 justify-start px-2 text-xs"
        title={label}
        aria-current={props.activePath === file.path ? "true" : undefined}
        onClick={() => props.onOpen(file.path)}
      >
        <Icon type="svg" href="/icons.svg#file" />
        <Text class="truncate">{label}</Text>
        <Text class="ml-auto text-muted-foreground">{kind}</Text>
      </Button>
      <Show
        when={stage}
        fallback={
          <Button variant="ghost" class="h-8 w-8 shrink-0" aria-label={`${props.copy.unstage} ${file.path}`} disabled={props.busy} onClick={() => props.onUnstage(file.path)}>
            <Icon type="svg" href="/icons.svg#close" />
          </Button>
        }
      >
        <Button variant="ghost" class="h-8 w-8 shrink-0" aria-label={`${props.copy.stage} ${file.path}`} disabled={props.busy} onClick={() => props.onStage(file.path)}>
          <Icon type="svg" href="/icons.svg#plus" />
        </Button>
      </Show>
    </Box>
  );
}
