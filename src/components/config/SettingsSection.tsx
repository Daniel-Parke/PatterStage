// ═══════════════════════════════════════════════════════════════
// SettingsSection — one section of config.yaml, on the one Settings page
//
// This was a page: header, back link, one card of fields, Save and Reset in
// the header bar. Twenty-seven of them, averaging three and a half fields,
// reached through an index of thirty cards (decision 7, T-0125). It is a
// section now, with the same fields, the same Save and the same rules, and
// the header it carries is its own: name, description, what it holds, and
// the two controls that act on it. Every Save is named for its section, so a
// screen reader hears "Save Agent Settings" rather than twenty-seven "Save".
//
// The nested keys that were never editable sit behind a disclosure. They were
// a read-only block at the foot of every section page, and on a page of
// twenty-seven sections a read-only block per section is what makes it two
// screens long. They are one click away and say what they are.
// ═══════════════════════════════════════════════════════════════

"use client";

import Link from "next/link";
import { AlertCircle, Check, RotateCcw, Save } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Skeleton from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/field";
import ConfigField from "@/components/config/ConfigField";
import EnvLineRow from "@/components/config/EnvLineRow";
import type { SectionEditor } from "@/hooks/useSettingsEditor";
import type { FieldDef } from "@/lib/config-schema";
import { envLineKey, parseEnvLine } from "@/lib/env-line";
import { iconColorMap } from "@/lib/theme";
import { pluralise } from "@/lib/utils";

/** Where an anchor lands: below the sticky header bar, with room to breathe. */
const SECTION_SCROLL_MARGIN = "scroll-mt-[calc(var(--ps-shell-header-min-height)_+_1.5rem)]";

const CHIP = "rounded-ps-sm px-1.5 py-0.5 font-mono text-micro";

/** A disclosure's one line: a 16px summary is under the 24px target floor. */
const SUMMARY =
  "cursor-pointer py-1 font-mono text-micro uppercase tracking-widest text-ps-text-muted hover:text-ps-text-secondary";

export interface SettingsSectionProps {
  editor: SectionEditor;
  /** True when the file is configured on disk, as the index's badge said. */
  configured: boolean;
  /** Fields the search matched, named on the section so the operator sees why. */
  hits: FieldDef[];
  /** config.yaml did not parse, so a yaml save would write over the whole file. */
  saveBlocked: string | null;
}

export default function SettingsSection({ editor, configured, hits, saveBlocked }: SettingsSectionProps) {
  const { section, values, hasChanges, problems, status, error, file } = editor;
  const Icon = section.icon;
  const isFile = section.type === "file";
  const isToolsetsPreview = section.id === "platform_toolsets";
  const readOnlyFile = file?.readOnly === true;
  const showActions = !isToolsetsPreview && !readOnlyFile && (section.fields.length > 0 || isFile);
  const yamlBlocked = !isFile && saveBlocked !== null;
  const problemSummary = problems.map((p) => p.message).join("; ");
  const saving = status === "saving";
  const complexKeys = isToolsetsPreview ? Object.keys(values).sort() : (section.complexKeys ?? []);

  return (
    <Card
      as="section"
      id={section.id}
      data-testid={`settings-section-${section.id}`}
      padding="none"
      className={SECTION_SCROLL_MARGIN}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ps-edge-hairline px-5 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-body font-semibold text-ps-text-primary">
            <Icon className={`h-4 w-4 shrink-0 ${iconColorMap[section.color]}`} />
            {section.label}
          </h3>
          <p className="mt-0.5 text-body text-ps-text-muted">{section.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {section.fields.length > 0 && (
              <span className={`${CHIP} bg-ps-surface-raised text-ps-text-faint`}>
                {section.fields.length} field{pluralise(section.fields.length)}
              </span>
            )}
            {isFile && <span className={`${CHIP} bg-ps-surface-raised text-ps-text-faint`}>file</span>}
            {configured && <span className={`${CHIP} bg-neon-green/5 text-neon-green/70`}>configured</span>}
            {complexKeys.length > 0 && !isToolsetsPreview && (
              <span className={`${CHIP} bg-neon-orange/5 text-neon-orange/90`}>
                +{complexKeys.length} read-only
              </span>
            )}
            {hits.slice(0, 3).map((f) => (
              <span key={f.key} data-testid="settings-hit" className={`${CHIP} bg-neon-cyan/10 text-neon-cyan`}>
                {f.label}
              </span>
            ))}
          </div>
        </div>

        {showActions && (
          <div className="flex shrink-0 items-center gap-2">
            {hasChanges && (
              <span className="flex items-center gap-1 font-mono text-micro text-neon-orange">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                UNSAVED
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              aria-label={`Reset ${section.label}`}
              disabled={!hasChanges}
              onClick={editor.reset}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              color={section.color}
              size="sm"
              aria-label={`Save ${section.label}`}
              icon={status === "saved" ? Check : Save}
              loading={saving}
              disabled={!hasChanges || yamlBlocked || problems.length > 0}
              title={yamlBlocked ? `config.yaml did not parse: ${saveBlocked}` : problemSummary || undefined}
              onClick={() => void editor.save()}
            >
              {saving ? "Saving…" : status === "saved" ? "Saved!" : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-5 px-5 py-4">
        {error && <LoadErrorBanner error={error} />}

        {isToolsetsPreview && (
          <p className="text-body text-ps-text-muted">
            The root agent&apos;s toolsets, as config.yaml holds them. They are changed on{" "}
            <Link href="/agent/tools" className="text-neon-orange hover:underline">
              Tools
            </Link>
            , per profile, and pushed from there.
          </p>
        )}

        {file && (
          <div>
            {file.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : file.error ? (
              <LoadErrorBanner error={file.error} />
            ) : file.readOnly ? (
              // Behind a disclosure, like the nested keys: two hundred masked
              // lines are reference material, and on the page by default they
              // were a fifth of everything the Settings page said (T-0125).
              <details>
                <summary className={SUMMARY}>
                  {file.content.split("\n").filter((l) => parseEnvLine(l).kind === "keyval").length}{" "}
                  variables, values masked
                </summary>
                <div className="mt-3 max-h-80 space-y-1 overflow-auto rounded-ps-md bg-ps-surface-inset p-3">
                  {file.content.split("\n").map((line, i) => (
                    <EnvLineRow
                      key={envLineKey(line, i)}
                      lineKey={envLineKey(line, i)}
                      parsed={parseEnvLine(line)}
                      raw={line}
                    />
                  ))}
                </div>
                <p className="mt-2 text-body text-ps-text-faint">
                  Values are masked and this view is read-only. Edit .env on the server.
                </p>
              </details>
            ) : (
              <Textarea
                aria-label={`${section.label} content`}
                value={file.content}
                onChange={(e) => file.update(e.target.value)}
                className="h-72 resize-y bg-ps-surface-inset"
                spellCheck={false}
              />
            )}
          </div>
        )}

        {/* Two to a row on a wide screen. Measured with every field on its own
            row the page was 15,874px tall: 95 fields, each a label, a sentence,
            a control and a status line. Side by side at xl it is about half
            that, and the section nav makes any of it one click. */}
        {section.fields.length > 0 && (
          <div className="grid gap-x-8 gap-y-5 xl:grid-cols-2">
            {section.fields.map((field) => (
              <ConfigField
                key={field.key}
                field={field}
                value={values[field.key]}
                sectionDef={section}
                onUpdate={editor.update}
              />
            ))}
          </div>
        )}

        {complexKeys.length > 0 && (
          <details className="group">
            <summary className={SUMMARY}>
              {complexKeys.length} read-only {complexKeys.length === 1 ? "field" : "fields"}
            </summary>
            <div className="mt-3 space-y-3">
              {complexKeys.map((key) => {
                const val = values[key];
                const isObj = typeof val === "object" && val !== null;
                const isEmpty = !val || (isObj && Object.keys(val as object).length === 0);
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-body text-ps-text-secondary">{key}</span>
                      {isEmpty && <span className={`${CHIP} bg-ps-surface-raised text-ps-text-faint`}>empty</span>}
                    </div>
                    <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-ps-md bg-ps-surface-inset p-3 font-mono text-micro text-ps-text-muted">
                      {/* "(not set)", the field vocabulary, not "(not configured)": the
                          latter contains the word the "configured" badge is, and a
                          reader of the section's text could not tell them apart. */}
                      {isEmpty ? "(not set)" : isObj ? JSON.stringify(val, null, 2) : String(val)}
                    </pre>
                  </div>
                );
              })}
              {!isToolsetsPreview && (
                <p className="text-body text-ps-text-faint">
                  Read-only here. Edit them in the agent&apos;s{" "}
                  <code className="text-ps-text-muted">config.yaml</code> on disk; this page reads that file,
                  so the new value appears on reload.
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}
