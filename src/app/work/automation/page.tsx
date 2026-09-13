// ═══════════════════════════════════════════════════════════════
// Automation — everything on a clock, in one place.
//
// Decision 9. Schedules used to be a section at the foot of Missions, which
// listed PatterStage's own table and could not see a script scheduled into the
// host crontab, and a column on Scripts, which could see that and nothing else.
// An operator asking "what runs tonight" read two screens and had to know which
// kind lived where.
//
// Missions keeps dispatch. Scripts keeps its file list. This is the clocks.
// ═══════════════════════════════════════════════════════════════

"use client";

import { CalendarClock } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import AutomationList from "@/components/automation/AutomationList";

export default function AutomationPage() {
  return (
    <AppPageShell
      header={
        <PageHeader
          icon={CalendarClock}
          title="Automation"
          subtitle="Every mission and script on a timer — what runs next, what ran last, and how it went"
          color="orange"
        />
      }
    >
      <AutomationList />
    </AppPageShell>
  );
}
