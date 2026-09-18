import type { AgentEvent } from "@buildy/agent-contract";

export type ReduceMessage = {
  id: string;
  role: "user" | "assistant" | "thinking" | "tool";
  text: string;
  streaming?: boolean;
  runId?: string;
  meta?: {
    tool?: string;
    toolStatus?: "running" | "done" | "error";
    durationMs?: number;
    callId?: string;
    detail?: string;
    kind?: string;
  };
};

export type ReduceState = {
  messages: ReduceMessage[];
  status: "idle" | "running" | "error";
  tools: string[];
  usage: {
    tokensIn: number;
    tokensOut: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  } | null;
  evidenceFiles: number | null;
  changedPaths: string[];
};

export function createReduceState(): ReduceState {
  return {
    messages: [],
    status: "idle",
    tools: [],
    usage: null,
    evidenceFiles: null,
    changedPaths: [],
  };
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function appendUserMessage(state: ReduceState, text: string): ReduceState {
  const trimmed = text.trim();
  if (!trimmed) return state;
  return {
    ...state,
    messages: [
      ...state.messages,
      { id: nextId("u"), role: "user", text: trimmed },
    ],
  };
}

export function reduceAgentEvent(
  state: ReduceState,
  event: AgentEvent,
  opts: { showThinking?: boolean; showToolTrace?: boolean } = {},
): ReduceState {
  const showThinking = opts.showThinking ?? true;
  const showToolTrace = opts.showToolTrace ?? true;
  const messages = state.messages.slice();
  let status = state.status;
  let tools = state.tools;
  let usage = state.usage;
  let evidenceFiles = state.evidenceFiles;
  let changedPaths = state.changedPaths;

  const stampRun = (runId?: string) => {
    if (!runId) return;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]!;
      if (m.role === "assistant") {
        messages[i] = { ...m, runId };
        return;
      }
    }
  };

  switch (event.type) {
    case "message.delta": {
      stampRun(event.runId);
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        messages[messages.length - 1] = {
          ...last,
          text: last.text + event.text,
          runId: event.runId ?? last.runId,
        };
      } else {
        messages.push({
          id: nextId("a"),
          role: "assistant",
          text: event.text,
          streaming: true,
          runId: event.runId,
        });
      }
      status = "running";
      break;
    }
    case "thinking.delta": {
      if (!showThinking) break;
      stampRun(event.runId);
      const last = messages[messages.length - 1];
      if (last?.role === "thinking" && last.streaming) {
        messages[messages.length - 1] = {
          ...last,
          text: last.text + event.text,
        };
      } else {
        messages.push({
          id: nextId("th"),
          role: "thinking",
          text: event.text,
          streaming: true,
        });
      }
      break;
    }
    case "thinking.completed": {
      if (!showThinking) break;
      const last = messages[messages.length - 1];
      if (last?.role === "thinking" && last.streaming) {
        messages[messages.length - 1] = {
          ...last,
          streaming: false,
          meta: {
            ...last.meta,
            durationMs: event.durationMs ?? last.meta?.durationMs,
          },
        };
      }
      break;
    }
    case "tool.started": {
      if (!showToolTrace) break;
      tools = [...tools.filter((t) => t !== event.tool), event.tool];
      let updated = false;
      if (event.callId) {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const m = messages[i]!;
          if (
            m.role === "tool" &&
            m.meta?.callId === event.callId &&
            m.meta?.toolStatus === "running"
          ) {
            messages[i] = {
              ...m,
              text: event.summary ?? m.text,
              streaming: true,
              meta: {
                ...m.meta,
                tool: event.tool,
                toolStatus: "running",
                callId: event.callId,
                detail: event.detail ?? m.meta?.detail,
                ...(event.kind ? { kind: event.kind } : {}),
              },
            };
            updated = true;
            break;
          }
        }
      }
      if (!updated) {
        messages.push({
          id: nextId("tool"),
          role: "tool",
          text: event.summary ?? event.tool,
          streaming: true,
          meta: {
            tool: event.tool,
            toolStatus: "running",
            ...(event.callId ? { callId: event.callId } : {}),
            ...(event.detail ? { detail: event.detail } : {}),
            ...(event.kind ? { kind: event.kind } : {}),
          },
        });
      }
      status = "running";
      break;
    }
    case "tool.delta": {
      if (!showToolTrace) break;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i]!;
        if (m.role !== "tool" || m.meta?.toolStatus !== "running") continue;
        if (event.callId) {
          if (m.meta?.callId !== event.callId) continue;
        } else if (m.meta?.tool !== event.tool && event.tool !== "shell") {
          continue;
        } else if (event.tool === "shell" && m.meta?.tool && m.meta.tool !== "shell") {
          continue;
        }
        messages[i] = {
          ...m,
          meta: {
            ...m.meta,
            detail: `${m.meta?.detail ?? ""}${event.text}`,
          },
        };
        break;
      }
      break;
    }
    case "tool.finished": {
      if (!showToolTrace) break;
      tools = tools.filter((t) => t !== event.tool);
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const m = messages[i]!;
        if (m.role !== "tool" || !m.streaming) continue;
        if (event.callId) {
          if (m.meta?.callId !== event.callId) continue;
        } else if (m.meta?.tool !== event.tool) {
          continue;
        }
        messages[i] = {
          ...m,
          text: event.summary ?? m.text,
          streaming: false,
          meta: {
            ...m.meta,
            tool: event.tool,
            toolStatus: "done",
            detail: event.detail || m.meta?.detail,
            ...(event.callId ? { callId: event.callId } : {}),
            ...(event.kind ? { kind: event.kind } : {}),
          },
        };
        break;
      }
      break;
    }
    case "files.changed":
      changedPaths = event.paths;
      break;
    case "session.status":
      if (event.status === "running" || event.status === "queued") {
        status = "running";
      } else if (event.status === "error") {
        status = "error";
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const m = messages[i]!;
          if (m.role === "assistant" && m.streaming) {
            messages[i] = { ...m, streaming: false };
            break;
          }
        }
      } else if (event.status === "idle") {
        status = "idle";
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          const m = messages[i]!;
          if (m.role === "assistant" && m.streaming) {
            messages[i] = { ...m, streaming: false };
            break;
          }
        }
      }
      break;
    case "usage":
      usage = {
        tokensIn: event.tokensIn,
        tokensOut: event.tokensOut,
        ...(event.cacheReadTokens !== undefined ? { cacheReadTokens: event.cacheReadTokens } : {}),
        ...(event.cacheWriteTokens !== undefined ? { cacheWriteTokens: event.cacheWriteTokens } : {}),
        ...(event.reasoningTokens !== undefined ? { reasoningTokens: event.reasoningTokens } : {}),
        ...(event.totalTokens !== undefined ? { totalTokens: event.totalTokens } : {}),
        ...(event.costUsd !== undefined ? { costUsd: event.costUsd } : {}),
      };
      stampRun(event.runId);
      break;
    case "evidence.used":
      evidenceFiles = event.files;
      stampRun(event.runId);
      break;
    default:
      break;
  }

  return { messages, status, tools, usage, evidenceFiles, changedPaths };
}

export function reduceEventSequence(
  events: AgentEvent[],
  opts?: { showThinking?: boolean; showToolTrace?: boolean },
): ReduceState {
  return events.reduce(
    (state, event) => reduceAgentEvent(state, event, opts),
    createReduceState(),
  );
}
