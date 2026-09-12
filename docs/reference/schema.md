---
title: Database schema
summary: The versioned schema artifacts, the bump policy, and how the JSON Schema files are generated
section: reference
nav: 20
audience: contributor
type: reference
tags: [product, schema]
compiled_from: normalised
---
# Schema versioning

## Current versions

| Artifact | Constant | Location |
|----------|-----------|----------|
| Mission record | inline `z.literal("1.0.0")` on `schemaVersion` | `src/lib/schema/mission-v1.ts` |
| Template pack manifest | inline `z.literal("1.0.0")` on `schemaVersion` | `src/lib/schema/template-pack-v1.ts` |

There is no `MISSION_SCHEMA_VERSION` or `TEMPLATE_PACK_SCHEMA_VERSION` constant.
This table named both for a long time; neither has ever existed in `src/`. The
version is an inline Zod literal, which is why bumping it means editing the schema
file rather than a shared constant.

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

See [CHANGELOG.md](schema.md).

---

## The schema's own changelog

Merged from `CHANGELOG.md` in T-0109, so one page answers one question.

## Changelog

## 1.0.0

- Initial versioned `MissionV1` and `TemplatePackManifestV1` Zod schemas.
- JSON Schema artifacts under `src/lib/schema/json/` generated via `npm run generate:schema-json`.
