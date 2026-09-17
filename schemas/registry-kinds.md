# Registry kinds

Every published record uses one of these kinds. `fwyml` branches on kind and
source kind only, never on registry id.

| Kind | Purpose |
| --- | --- |
| `capability` | stack-neutral port and conformance reference |
| `adapter` | one concrete implementation of one capability |
| `generator` | external code generator |
| `validator` | external executable check |
| `guidance` | rules or spec files copied into the user repository |
| `vertical-slice` | UI/orchestration glue over declared ports |
| `product-template` | minimal composition root, not a finished product |
| `delivery` | package layout and build output contract |

A vertical slice is registry data. It is not an FW capability.
