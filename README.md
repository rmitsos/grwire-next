# grwire-next

Small, dependency-free ingestion primitives for organization intelligence. It provides adapters for RSS/Atom feeds, XML sitemaps, and HTML link listings; a common normalized item shape; evidence-required organization relationships; and an authenticated import coordinator.

```js
import { PrivateImportWorkflow } from "grwire-next";

const workflow = new PrivateImportWorkflow({ secret: process.env.IMPORT_SECRET, store });
await workflow.run({ token, source: { type: "rss", url: "https://example.com/feed.xml" } });
```

The workflow is intentionally private-by-construction: callers supply a shared secret, source URLs are restricted to HTTP(S), and persistence is delegated to an injected store implementing `upsertItems(items, context)`.
