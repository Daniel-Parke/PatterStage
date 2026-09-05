---
title: The first hour
summary: "One path end to end: the agent installed, the browser signed in, a model chosen, a mission dispatched and its output read"
section: start-here
nav: 30
audience: operator
concepts: [mission, run, session, artifact]
---

# The first hour

One path, end to end: an agent on the machine, a browser signed in, a model the
agent can call, one [mission](../concepts/mission.md) dispatched, and its
transcript and its output read back. An hour is generous. Most of it is waiting
for the agent.

This assumes you have already followed [installing](install.md).

## 1. Install the agent

PatterStage is the control plane; Hermes is the thing that does the work.
Install it on the same machine from the
[Hermes installation guide](https://hermes-agent.nousresearch.com/docs/getting-started/installation),
and run `hermes setup` if it asks you to. The bootstrap installer offers to do
this for you.

If the agent lives on another box instead, that works too: point
`HERMES_GATEWAY_URL` at its API server and make sure `API_SERVER_KEY` matches on
both sides. PatterStage treats a reachable gateway as a usable agent.

## 2. Start PatterStage and open the link it prints

```bash
npm run start
```

The first `[auth]` line of the output carries a one-time sign-in URL of the form
`http://127.0.0.1:<PORT>/?ps_token=<token>`. Open it once. The token is swapped
for a session cookie and removed from the address bar, so you never paste it
again in that browser.

If you scrolled past the line, the token is the single line in
`<PS_DATA_DIR>/auth-token`, and restarting the server prints the URL again.

## 3. Read the Subsystems panel before anything else

You land on the [dashboard](../guides/dashboard.md). Near the top is
**Subsystems**: five rows, each with a state and a reason written in words.

| Row | What it answers |
|---|---|
| Gateway | Can PatterStage reach the agent, at which address, and if not, why not. |
| Memory | Is a memory provider configured and answering. |
| Sync | Did the last background cycle complete cleanly. |
| config.yaml | Is the agent's configuration file present and parseable. |
| Gateway gate | Is the agent keeping up with the requests being sent to it. |

Fix a red Gateway row before you dispatch anything. Memory is optional, so it
reads degraded rather than down when there is nothing configured, and you can
leave it that way for now.

Below it, on an install that has not run anything yet, is a short checklist. It
is the same path as this page, and it ticks itself off as you go.

## 4. Give the agent a model

Open [Models](../guides/models.md) at `/agent/models`. Nothing dispatches
without one, and a mission sent to an agent with no model fails before it
really starts.

1. Add a [model](../concepts/model.md): a name, its
   [provider](../concepts/provider.md), and the provider's own model id.
2. Add the [API key](../concepts/api-key.md) that provider needs. Local and
   self-hosted providers such as Ollama, LM Studio and vLLM need no key at all,
   and the editor does not ask for one when you pick them.
3. Make it the default for the agent slot, so work with no model of its own has
   something to run on.

## 5. Dispatch one mission

Open [Missions](../guides/missions.md) at `/work/missions` and compose one. The
bundled templates are the easy start: pick one, read the prompt it filled in,
and change the instruction to something you can check the answer to.

Choose **Run now**. The other dispatch modes save a draft, put it in the queue,
or attach a recurring [schedule](../concepts/schedule.md); they are worth
knowing about, but not on the first pass.

Keep the first mission small. A vague instruction produces a long, expensive
[run](../concepts/run.md) that is hard to judge.

## 6. Watch it finish

The mission moves across the board: Dispatched, then Completed or Failed. That
transition is not driven by your browser. A scheduler that boots with the server
polls the agent every few seconds and writes the terminal state to the run, the
mission and the session together, so closing the tab does not stop or lose
anything.

If it sits in Dispatched for a long time, the agent is still working. If it
fails, the mission carries the reason, and step 7 shows you what actually
happened.

## 7. Read the transcript

Open [Sessions](../guides/sessions.md) at `/results/sessions`. Every run leaves
a [session](../concepts/session.md), and inside it the
[transcript](../concepts/transcript.md): what you asked, what the agent
reasoned, which tools it called, what those returned, and the reply.

This is the screen that answers "why did it do that". A mission that failed
almost always failed at one identifiable tool call, and it is visible here.

## 8. Read the artifact

Open [Artifacts](../guides/artifacts.md) at `/results/artifacts`. When a mission
completes with output, that output is kept as an
[artifact](../concepts/artifact.md) automatically, with the mission's name and a
link back to the run that produced it. A mission that produced no text leaves no
artifact, which is itself worth noticing.

## What to do with the rest of the hour

- Check [Insights](../guides/insights.md) at `/results/insights`. Your first run
  is already counted, including what it spent at the provider.
- Take a backup from Settings > System, before you have anything to lose. See
  [backup and restore](../running/backup.md).
- Follow the [quests](quests.md), which walk the same ground in short chains.
- When a word on a screen is unfamiliar, the [concepts](../concepts/agent.md)
  pages are one short page each.
