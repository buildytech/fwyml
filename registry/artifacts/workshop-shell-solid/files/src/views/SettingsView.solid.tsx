import { For, createSignal } from "solid-js";
import { Block, Box, Button, Icon, Stack, Title } from "$ui8kit/ui";
import { WorkspaceSettings } from "$components/widgets/WorkspaceSettings.solid";
import type { copy as Copy } from "$lib/copy";
import type { Prefs } from "$lib/prefs";

export function SettingsView(props: {
  copy: typeof Copy;
  prefs: Prefs;
  onPrefs: (patch: Partial<Prefs>) => void;
  onClose: () => void;
}) {
  const [section, setSection] = createSignal("appearance");
  const sections = () => [
    { id: "appearance", label: props.copy.settingsAppearance },
    { id: "editor", label: props.copy.settingsEditor },
    { id: "agent", label: props.copy.settingsAgent },
  ];
  return (
    <Block tag="section" class="flex min-h-0 flex-1 flex-col" aria-label={props.copy.settingsTitle}>
      <Box class="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <Title as={1} id="reader-title" class="m-0 text-sm">{props.copy.settingsTitle}</Title>
        <Button variant="ghost" size="sm" onClick={props.onClose}>
          <Icon type="svg" href="/icons.svg#close" />
          {props.copy.backEditor}
        </Button>
      </Box>
      <Box class="flex min-h-0 flex-1">
        <Stack class="w-48 shrink-0 gap-2 border-r border-border bg-card p-4">
          <For each={sections()}>
            {(item) => (
              <Button
                variant="ghost"
                class={`justify-start text-sm ${section() === item.id ? "bg-accent" : ""}`}
                aria-pressed={section() === item.id}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </Button>
            )}
          </For>
        </Stack>
        <Box class="min-w-0 flex-1 overflow-auto p-8">
          <Box class="max-w-lg">
            <WorkspaceSettings copy={props.copy} prefs={props.prefs} onPatch={props.onPrefs} section={section()} />
          </Box>
        </Box>
      </Box>
    </Block>
  );
}
