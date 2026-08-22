---
summary: The versioned schema artifacts, the bump policy, and how the JSON Schema files are generated
type: reference
tags: [product, schema]
compiled_from: normalised
---

# Schema versioning

## Current versions

| Artifact | Constant | Location |
|----------|-----------|----------|
| Mission record | `MISSION_SCHEMA_VERSION` (`1.0.0`) | `src/lib/schema/mission-v1.ts` |
| Template pack manifest | `TEMPLATE_PACK_SCHEMA_VERSION` (`1.0.0`) | `src/lib/schema/template-pack-v1.ts` |

## Bump policy

- **Patch** (`1.0.x`): documentation-only or additive optional fields ignored by older readers.
- **Minor** (`1.x.0`): new optional fields; maintain backward compatibility for existing files.
- **Major** (`x.0.0`): breaking shape changes; provide migration notes and a migration window in PatterStage release notes.

## Generated JSON Schema

After changing Zod schemas, run from the repo root (implementation: `scripts/tooling/generate-json-schema.ts`):

```bash
npm run generate:schema-json
```

Commit updated files under `src/lib/schema/json/`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
