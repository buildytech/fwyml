import { For, Show, createSignal } from "solid-js";
import { Block, Box, Button, Input, Select, SelectOption, Text } from "$ui8kit/ui";
import type { copy as Copy } from "$lib/copy";
import { diagnosticLocation } from "$lib/diagnostics";

export function ProblemsPanel(props: {
  copy: typeof Copy; busy: boolean; output: string; passed: boolean | null;
  stale?: boolean; ranTool?: string;
  tool: string; config: string; onTool: (tool: string) => void;
  onConfig: (config: string) => void;   onRun: () => void;
  onSaveAllCheck?: () => void;
  onCancel?: () => void;
  onOpen: (path: string, line: number, column: number) => void;
}) {
  const [optionsOpen, setOptionsOpen] = createSignal(false);
  const showOptions = () => props.passed === null || optionsOpen();
  return <Block tag="section" aria-label={props.copy.problems} class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2">
    <Text role="status" class="text-sm font-medium">{
      props.busy ? props.copy.validating
        : props.passed === null ? props.copy.validationIdle
        : props.stale ? props.copy.validationStale
        : props.ranTool && props.ranTool !== props.tool ? props.copy.validationWrongTool
        : props.passed ? props.copy.validationPassed
        : props.copy.validationFailed
    }</Text>
    <Box class="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={props.busy} onClick={props.onRun}>{props.busy ? props.copy.validating : props.copy.validateProject}</Button>
      <Button variant="secondary" size="sm" disabled={props.busy} onClick={() => props.onSaveAllCheck?.()}>{props.copy.saveAllCheck}</Button>
      <Show when={props.busy}><Button variant="secondary" size="sm" onClick={() => props.onCancel?.()}>{props.copy.cancelCheck}</Button></Show>
      <Show when={props.passed !== null}>
        <Button variant="ghost" size="sm" aria-pressed={optionsOpen()} onClick={() => setOptionsOpen(v => !v)}>{props.copy.checkOptions}</Button>
      </Show>
    </Box>
    <Show when={showOptions()}>
      <Box class="flex flex-wrap items-center gap-2">
        <Select class="w-auto" aria-label={props.copy.validationTool} value={props.tool} disabled={props.busy} onChange={(e: Event & {currentTarget: HTMLSelectElement}) => props.onTool(e.currentTarget.value)}>
          <SelectOption value="typescript">TypeScript</SelectOption><SelectOption value="go">Go</SelectOption>
        </Select>
        <Show when={props.tool === "typescript"}><Input class="w-64" aria-label={props.copy.validationConfig} value={props.config} disabled={props.busy} placeholder="tsconfig.json" onInput={(e: InputEvent & {currentTarget: HTMLInputElement}) => props.onConfig(e.currentTarget.value)} /></Show>
      </Box>
      <Show when={props.passed === null}><Text class="text-xs text-muted-foreground">{props.copy.validationHelp}</Text></Show>
    </Show>
    <Box class="min-h-0 flex-1 overflow-auto font-mono text-xs">
      <For each={props.output.split("\n").filter(Boolean)}>{line => {
        const location = diagnosticLocation(line);
        return location ? <Button variant="ghost" class="h-auto w-full justify-start whitespace-pre-wrap px-2 py-2 text-left font-mono text-xs" onClick={() => props.onOpen(location.path, location.line, location.column)}>{line}</Button> : <Text class="whitespace-pre-wrap py-1">{line}</Text>;
      }}</For>
    </Box>
  </Block>;
}
