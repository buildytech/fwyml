import { Block, Button, Fieldset, FormItem, Group, Label, Legend, Switch, Text } from "$ui8kit/ui";
import { resetColumnPct } from "$lib/column-split";
import type { copy as Copy } from "$lib/copy";
import type { Prefs, TabSize, UiZoom } from "$lib/prefs";
import type { Palette, Theme } from "$lib/theme";
import { TokenSelect } from "./TokenSelect.solid";

export function WorkspaceSettings(props: {
  section?: string;
  copy: typeof Copy;
  prefs: Prefs;
  onPatch: (patch: Partial<Prefs>) => void;
}) {
  return (
    <Block class="flex flex-col gap-6">
      <Text id="settings-help" class="text-sm text-muted-foreground">{props.copy.settingsHelp}</Text>
      <Fieldset hidden={props.section !== "appearance"} class="m-0 flex flex-col gap-3 border-0 p-0">
        <Legend class="p-0 text-sm font-medium">{props.copy.settingsAppearance}</Legend>
        <FormItem>
          <Label htmlFor="settings-theme">{props.copy.themeAria}</Label>
          <TokenSelect
            id="settings-theme"
            class="mt-2 w-full"
            value={String(props.prefs.theme)}
            aria-label={props.copy.themeAria}
            options={[
              { value: "system", label: props.copy.themeSystem },
              { value: "light", label: props.copy.themeLight },
              { value: "dark", label: props.copy.themeDark },
            ]}
            onChange={(value) => props.onPatch({ theme: value as Theme })}
          />
        </FormItem>
        <FormItem>
          <Label htmlFor="settings-palette">{props.copy.paletteAria}</Label>
          <TokenSelect
            id="settings-palette"
            class="mt-2 w-full"
            value={String(props.prefs.palette)}
            aria-label={props.copy.paletteAria}
            options={[
              { value: "default", label: props.copy.paletteDefault },
              { value: "hinddy", label: props.copy.paletteHinddy },
            ]}
            onChange={(value) => {
              if (value === "default" || value === "hinddy") props.onPatch({ palette: value as Palette });
            }}
          />
        </FormItem>
        <Group class="items-center gap-2">
          <Switch
            id="settings-header"
            checked={props.prefs.hideHeader}
            onChange={(event: Event & { currentTarget: HTMLInputElement }) =>
              props.onPatch({ hideHeader: event.currentTarget.checked })
            }
          />
          <Label htmlFor="settings-header">{props.copy.hideHeader}</Label>
        </Group>
        <Button
          variant="secondary"
          size="sm"
          class="self-start"
          onClick={() => {
            const next = resetColumnPct();
            props.onPatch({ treePct: next.tree, chatPct: next.chat });
          }}
        >
          {props.copy.resetLayout}
        </Button>
      </Fieldset>
      <Fieldset hidden={props.section !== "editor"} class="m-0 flex flex-col gap-3 border-0 p-0">
        <Legend class="p-0 text-sm font-medium">{props.copy.settingsEditor}</Legend>
        <FormItem>
          <Label htmlFor="settings-tab">{props.copy.editorTabSize}</Label>
          <TokenSelect
            id="settings-tab"
            class="mt-2 w-full"
            value={String(props.prefs.tabSize)}
            aria-label={props.copy.editorTabSize}
            options={[
              { value: "2", label: props.copy.tabSize2 },
              { value: "4", label: props.copy.tabSize4 },
              { value: "8", label: props.copy.tabSize8 },
            ]}
            onChange={(value) => props.onPatch({ tabSize: Number(value) as TabSize })}
          />
        </FormItem>
        <FormItem>
          <Label htmlFor="settings-font">{props.copy.editorFontScale}</Label>
          <TokenSelect
            id="settings-font"
            class="mt-2 w-full"
            value={String(props.prefs.fontScale)}
            aria-label={props.copy.editorFontScale}
            options={[
              { value: "sm", label: props.copy.fontSmall },
              { value: "md", label: props.copy.fontMedium },
              { value: "lg", label: props.copy.fontLarge },
            ]}
            onChange={(value) => {
              if (value === "sm" || value === "md" || value === "lg") props.onPatch({ fontScale: value });
            }}
          />
        </FormItem>
        <FormItem>
          <Label htmlFor="settings-zoom">{props.copy.uiZoom}</Label>
          <TokenSelect
            id="settings-zoom"
            class="mt-2 w-full"
            value={String(props.prefs.uiZoom)}
            aria-label={props.copy.uiZoom}
            options={[
              { value: "100", label: props.copy.zoom100 },
              { value: "125", label: props.copy.zoom125 },
              { value: "150", label: props.copy.zoom150 },
              { value: "200", label: props.copy.zoom200 },
            ]}
            onChange={(value) => {
              const zoom = Number(value) as UiZoom;
              if (zoom === 100 || zoom === 125 || zoom === 150 || zoom === 200) props.onPatch({ uiZoom: zoom });
            }}
          />
        </FormItem>
        <Group class="items-center gap-2">
          <Switch
            id="settings-wrap"
            checked={props.prefs.lineWrap}
            onChange={(event: Event & { currentTarget: HTMLInputElement }) =>
              props.onPatch({ lineWrap: event.currentTarget.checked })
            }
          />
          <Label htmlFor="settings-wrap">{props.copy.editorLineWrap}</Label>
        </Group>
      </Fieldset>
      <Fieldset hidden={props.section !== "agent"} class="m-0 flex flex-col gap-3 border-0 p-0">
        <Legend class="p-0 text-sm font-medium">{props.copy.settingsAgent}</Legend>
        <FormItem>
          <Label htmlFor="settings-bridge">{props.copy.agentBridge}</Label>
          <TokenSelect
            id="settings-bridge"
            class="mt-2 w-full"
            value={String(props.prefs.bridge)}
            aria-label={props.copy.agentBridge}
            options={[
              { value: "cursor", label: props.copy.bridgeCursor },
              { value: "pi", label: props.copy.bridgePi, disabled: true },
              { value: "openai-sdk", label: props.copy.bridgeOpenAi, disabled: true },
            ]}
            onChange={(value) => {
              if (value === "cursor") props.onPatch({ bridge: "cursor" });
            }}
          />
        </FormItem>
        <Group class="items-center gap-2">
          <Switch
            id="settings-thinking"
            checked={props.prefs.showThinking}
            onChange={(event: Event & { currentTarget: HTMLInputElement }) =>
              props.onPatch({ showThinking: event.currentTarget.checked })
            }
          />
          <Label htmlFor="settings-thinking">{props.copy.showThinking}</Label>
        </Group>
        <Group class="items-center gap-2">
          <Switch
            id="settings-tools"
            checked={props.prefs.showToolTrace}
            onChange={(event: Event & { currentTarget: HTMLInputElement }) =>
              props.onPatch({ showToolTrace: event.currentTarget.checked })
            }
          />
          <Label htmlFor="settings-tools">{props.copy.showToolTrace}</Label>
        </Group>
        <Text class="text-sm text-muted-foreground">{props.copy.settingsSecrets}</Text>
      </Fieldset>
    </Block>
  );
}
