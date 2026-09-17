export const AGENT_CONTRACT_VERSION = "1" as const;

export type AgentEvent =
  | { type: "message.delta"; sessionId: string; role: "assistant"; text: string }
  | { type: "thinking.delta"; sessionId: string; text: string }
  | { type: "thinking.completed"; sessionId: string }
  | { type: "tool.started"; sessionId: string; name: string }
  | { type: "tool.completed"; sessionId: string; name: string }
  | { type: "run.completed"; sessionId: string }
  | { type: "run.failed"; sessionId: string; message: string }
  | { type: "run.aborted"; sessionId: string };

export const AGENT_EVENT_TYPES: ReadonlyArray<AgentEvent["type"]> = [
  "message.delta",
  "thinking.delta",
  "thinking.completed",
  "tool.started",
  "tool.completed",
  "run.completed",
  "run.failed",
  "run.aborted",
];
