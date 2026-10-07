---
title: Quests
summary: "A guided path through PatterStage, ticked off by what you actually did rather than by what you read"
section: reference
nav: 25
audience: operator
---

# Quests

Thirty-two things worth doing, in seven chapters, from a fresh install to a
backup you can restore from. Each one asks for a real action on a real screen,
and each one is ticked by a fact the server already holds: an event in the
ledger, or a row in a table.

Nothing here is a checkbox you can tick yourself, and that is the point. A
quest completes because you dispatched a mission, not because you said you did,
and the same ledger the Insights page charts is the one that says so.

## How a quest completes

Progress is worked out inside the reading the dashboard already makes, so the
Quests page costs no extra request. Once a quest is complete it stays complete:
the moment it was first seen done is written into your preferences as a
high-water mark, so pruning old sessions or clearing a table can never take one
back off you.

Two of them are approximations, and they say so in the table below. Quest 2.1
asks you to use a template and is proved by a second dispatch, because the
ledger counts dispatches and does not record where a prompt came from. Quest
4.4 asks you to read a transcript and is proved by one arriving, because
opening a page is not something this product records.

Two quests in chapter 4 are the exception. Reading an artifact and reading a
log file each record an event of their own, which is the only place in
PatterStage where looking at something is written down.

## Skipping

Skip anything that does not apply to your install. A skipped quest leaves the
count, so the number at the top stays honest: it is what is left of what you
mean to do, not of what the product wishes you would.

Quest 1.2 is the one most people skip. It wants an API key, and a local
provider like Ollama needs none.

## Chapters

<!-- generated:quests -->
### 1. Get running

An agent that can answer, and one piece of work you gave it, finished.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **1.1** Add a model | Add a model on the Models page, so the agent has something to think with. | proved by the `model.added` event, once | `/agent/models` | Model, Provider | - |
| **1.2** Add a credential | Add the API key your provider needs. Skip this one if your provider is keyless. | proved by the `credential.added` event, once | `/agent/models` | API key, Provider | - |
| **1.3** Send a first message | Say something to your agent in Chat and read what comes back. | proved by the `chat.message_sent` event, once | `/work/chat` | Agent, Prompt | `first-words` |
| **1.4** Dispatch a mission | Write one piece of work on the Missions page and dispatch it. | proved by the `mission.dispatched` event, once | `/work/missions` | Mission, Run | - |
| **1.5** See it finish | Wait for that mission to finish, then open its session and read the transcript. | proved by the `mission.completed` event, once | `/results/sessions` | Session, Transcript | `first-contact` |

On a host without it, **1.3** says: No agent is reachable yet: install the agent on this machine, or point PatterStage at a gateway, and this one unlocks.

On a host without it, **1.4** says: No agent is reachable yet: install the agent on this machine, or point PatterStage at a gateway, and this one unlocks.

On a host without it, **1.5** says: No agent is reachable yet: install the agent on this machine, or point PatterStage at a gateway, and this one unlocks.

### 2. Missions

Work you can save, repeat, put on a clock, and call off.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **2.1** Use a template | Load one of the mission templates, adjust it, and dispatch that. | proved by the `mission.dispatched` event, twice | `/work/missions` | Mission | - |
| **2.2** Save a template | Save a mission you would write again as a template of your own. | proved by the `template.saved` event, once | `/work/missions` | Mission | - |
| **2.3** Put it on a schedule | Give a mission a schedule, so it runs without you starting it. | proved by the `schedule.created` event, once | `/work/missions` | Schedule | `automator` |
| **2.4** Watch it fire | Come back after the schedule is due and find the run it started. | proved by the `schedule.fired` event, once | `/results/sessions` | Schedule, Run | - |
| **2.5** Cancel a mission | Stop a mission you no longer want, before it finishes. | proved by the `mission.cancelled` event, once | `/work/missions` | Run | - |

On a host without it, **2.1** says: No agent is reachable yet: install the agent on this machine, or point PatterStage at a gateway, and this one unlocks.

### 3. Shape your agent

An agent that sounds like you want it to and reaches only for what you allow.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **3.1** Add a second profile | Create a second agent profile, so one agent can work more than one way. | proved by the store: 2 or more `profiles` | `/agent/profiles` | Profile | - |
| **3.2** Give it a personality | Write the voice you want that profile to use, on its Identity tab. | proved by the `personality.changed` event, once | `/agent/profiles` | Personality, Profile | - |
| **3.3** Toggle a skill | Turn a skill on or off and see what the profile is allowed to follow. | proved by the `skill.toggled` event, once | `/agent/skills` | Skill | - |
| **3.4** Save a toolset | Choose which toolsets this profile may reach for, and save them. | proved by the `toolset.saved` event, once | `/agent/tools` | Tool, Toolset | - |
| **3.5** Save a settings section | Change one thing in Settings and save it, so the agent reads it next run. | proved by the `config.saved` event, once | `/agent/settings` | Agent | - |
| **3.6** Connect memory | Point PatterStage at a memory provider and test the connection. | proved by the store: `memoryConfigured` | `/agent/memory` | Memory | - |
| **3.7** Retain a fact | Give the agent one thing worth remembering between runs. | proved by the `memory.retained` event, once | `/agent/memory` | Memory | - |
| **3.8** Push to Hermes | Push a profile to the agent on disk, so the two agree. | proved by the `profile.pushed` event, once | `/agent/profiles` | Profile | - |

On a host without it, **3.7** says: No memory provider is answering, so there is nothing to retain a fact into yet. Connect one on the Memory screen and this one unlocks.

### 4. Automate and watch

Your own scripts on a timer, and the record of what they did.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **4.1** Save a script | Write a small script of your own and save it. | proved by the `script.saved` event, once | `/work/scripts` | Run | - |
| **4.2** Run it | Run that script once by hand and read its output. | proved by the `script.run` event, once | `/work/scripts` | Run | - |
| **4.3** Schedule it | Put the script on a timer, so it runs without you. | proved by the `script.scheduled` event, once | `/work/scripts` | Schedule | - |
| **4.4** Read a transcript | Open a session and read what the agent actually said and did. | proved by the `session.started` event, once | `/results/sessions` | Session, Transcript | - |
| **4.5** Read its artifact | Open something your agent produced and read it in full. | proved by the `artifact.opened` event, once | `/results/artifacts` | Artifact | - |
| **4.6** Read the logs | Open a log file and see what the host itself recorded. | proved by the `logs.opened` event, once | `/results/logs` | - | - |

On a host without it, **4.3** says: Host script scheduling is not available on native Windows. Run PatterStage under WSL2, or wait for PatterStage's own scheduler to take over scripts.

### 5. Multi-stage work

Several runs wired together, with you in the loop where it matters.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **5.1** Run the starter workflow | Run one of the workflows that ships with PatterStage, start to finish. | proved by the `composer.run_started` event, once | `/work/composer` | Workflow | - |
| **5.2** Approve a gate | Answer a workflow that stopped to ask you, and let it carry on. | proved by the `composer.gate_approved` event, once | `/work/composer` | Gate, Workflow | - |
| **5.3** Run Deep Research | Ask a research question and let the agent go and read for you. | proved by the `research.started` event, once | `/work/research` | Artifact | - |
| **5.4** Save an artifact | Keep something the agent produced, so it outlives the run. | proved by the `artifact.saved` event, once | `/results/artifacts` | Artifact | - |

On a host without it, **5.1** says: The Composer is switched off on this install (PS_COMPOSER). Turn it on to run a workflow.

On a host without it, **5.2** says: The Composer is switched off on this install (PS_COMPOSER). Turn it on to run a workflow.

On a host without it, **5.3** says: No agent is reachable yet: install the agent on this machine, or point PatterStage at a gateway, and this one unlocks.

### 6. Rec Room

The same machinery, pointed at something long and made up.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **6.1** Start a story | Give the Story Weaver a premise and let it plan the chapters. | proved by the `story.created` event, once | `/recroom/story-weaver` | Prompt | `storyteller` |
| **6.2** Write a chapter | Ask for one chapter and read it. | proved by the `story.chapter_generated` event, once | `/recroom/story-weaver` | Model | - |
| **6.3** Finish a story | Keep writing until every chapter is done. | proved by the `story.completed` event, once | `/recroom/story-weaver` | - | - |

### 7. Keep it healthy

A copy of everything, taken before you need it.

| Quest | What to do | Proof | Screen | Teaches | Earns |
| --- | --- | --- | --- | --- | --- |
| **7.1** Take a backup | Take a copy of your database, before the day you need one. | proved by the `backup.taken` event, once | `/agent/settings/system` | - | - |
<!-- /generated:quests -->

## Where this is shown

The Quests page is in the rail under Home, and the dashboard carries the next
one worth doing. The rail shows how many are left; it disappears when there are
none.
