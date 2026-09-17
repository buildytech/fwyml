# Composition semantics

Vertical slices are registry records. They are not FW capabilities.

Each `vertical-slice` record declares:

- required capabilities;
- provided surfaces;
- compatible UI and host families;
- required adapters or abstract adapter constraints;
- generated or copied files it owns;
- dependencies and conflicts;
- removal behavior;
- guidance and validators it contributes.

A product manifest selects one UI runtime through its `ui` adapter. A slice
may list several UI families; resolution keeps exactly one runtime already
chosen by the product.

Removal is deterministic. After a slice is dropped, no file, dependency,
menu item, route, generated binding, or delivery artifact it owns remains.

The same `agent-chat-surface` contract may resolve to a Svelte or Solid
artifact through adapter and slice data. FW does not import either
framework.
