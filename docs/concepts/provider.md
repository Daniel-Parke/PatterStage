---
title: Provider
summary: "Who serves the model: a cloud API, a local server, or the agent's own gateway"
section: concepts
nav: 40
audience: operator
---

# Provider

## What it is

Whoever serves the model: OpenAI, Anthropic, OpenRouter, Groq, Mistral,
DeepSeek and others, or a local endpoint such as Ollama, LM Studio or vLLM
running on your own machine. Every [model](model.md) entry names one. The
provider decides the wire protocol used to reach it and which environment
variable the agent reads its key from.

Several providers need no key at all. The local and self-hosted ones do not, and
one authenticates by sign-in through the agent's own command line instead. The
model editor stops asking for a key when you pick one of those.

## What it is not

Not the gateway. The gateway is the agent's HTTP server on your own machine,
which PatterStage always talks to; the provider is the party at the far end who
bills you. And not the model: one provider serves many models, and the same
model is often served by several providers at different prices.

## Where you meet it

On the [Models](../guides/models.md) page, as a field on each model and each
credential.

## The idea behind it

A local model and a metered cloud model should sit in the same list and be
swappable with one edit. Making the provider a named thing rather than part of
the model string is what allows that, and it is what lets a keyless endpoint on
your desk sit one row above a service you are paying by the token.
