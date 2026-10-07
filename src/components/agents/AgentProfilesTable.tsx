// ═══════════════════════════════════════════════════════════════
// AgentProfilesTable — every profile, one row each
//
// Was AgentProfileList: a 256px column of cards down the left of the page,
// each one the name, the slug, the description, two counts and a sync line,
// about 170px tall, so eight profiles were 1,360px of column beside a detail
// card that got the rest. A profile record is a name and six comparable
// facts, which WG-WEB-003 (D) rules is a table; eight of them are 320px of
// table, and the detail card gets the full width underneath (T-0125).
//
// Selecting is still here - the name is the control - but it is no longer
// the ONLY control: the header's ProfilePicker is the same choice, and this
// table marks the row it made. Push and pull are row actions now, named for
// their row, rather than two links after a bar of five that changed their
// wording to match whichever profile was selected.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import DataList, { type DataListColumn } from "@/components/ui/DataList";
import IconButton from "@/components/ui/IconButton";
import { timeAgo } from "@/lib/utils";
import type { AgentProfile } from "@/types/console";

/** The list's cosmetic suffix is not the name. */
function profileDisplayName(profile: AgentProfile): string {
  return profile.isDefault ? profile.name.replace(/\s*\(local default\)\s*$/i, "") : profile.name;
}

export interface AgentProfilesTableProps {
  profiles: AgentProfile[];
  selectedProfileId: string | null;
  onSelect: (profile: AgentProfile) => void;
  onPushOne: (slug: string) => void;
  onPullOne: (slug: string) => void;
  busy: boolean;
}

export default function AgentProfilesTable({
  profiles,
  selectedProfileId,
  onSelect,
  onPushOne,
  onPullOne,
  busy,
}: AgentProfilesTableProps) {
  const columns: DataListColumn<AgentProfile>[] = [
    {
      key: "name",
      header: "Profile",
      primary: true,
      render: (p) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2.5 font-semibold" onClick={() => onSelect(p)}>
            {profileDisplayName(p)}
          </Button>
          {p.isDefault && (
            <Badge color="cyan" size="sm">
              Local default
            </Badge>
          )}
          {p.syncStatus === "drift" && (
            <Badge color="orange" size="sm">
              Drift
            </Badge>
          )}
          {p.syncStatus === "error" && (
            <Badge color="orange" size="sm">
              Sync error
            </Badge>
          )}
          {/* The reason, not just the word (T-0102, D27). */}
          {p.syncError && (
            <span className="basis-full break-words text-body text-semantic-warning">{p.syncError}</span>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      hideBelow: "md",
      render: (p) => (
        <span className="font-mono text-micro text-ps-text-faint">{p.isDefault ? "default" : p.id}</span>
      ),
    },
    {
      key: "skills",
      header: "Skills",
      align: "right",
      render: (p) => <span className="font-mono tabular-nums text-ps-text-secondary">{p.skillsCount}</span>,
    },
    {
      key: "files",
      header: "Files",
      align: "right",
      hideBelow: "sm",
      render: (p) => <span className="font-mono tabular-nums text-ps-text-secondary">{p.files.length}</span>,
    },
    {
      key: "pushed",
      header: "Last pushed",
      hideBelow: "lg",
      render: (p) => (
        <span className="font-mono text-micro text-ps-text-muted">
          {p.syncedAt ? `Last pushed ${timeAgo(p.syncedAt)}` : "Never pushed"}
        </span>
      ),
    },
  ];

  return (
    <DataList
      caption="Profiles"
      columns={columns}
      rows={profiles}
      rowKey={(p) => p.id}
      rowTestId={(p) => `profile-row-${p.id}`}
      selectedKey={selectedProfileId}
      collapseBelow="lg"
      actions={(p) => (
        <>
          <IconButton
            size="sm"
            icon={ArrowUpToLine}
            color="purple"
            label={`Push ${profileDisplayName(p)} to Hermes`}
            disabled={busy}
            onClick={() => onPushOne(p.id)}
          />
          <IconButton
            size="sm"
            icon={ArrowDownToLine}
            color="cyan"
            label={`Pull ${profileDisplayName(p)} from Hermes`}
            disabled={busy}
            onClick={() => onPullOne(p.id)}
          />
        </>
      )}
    />
  );
}
