---
title: API key
summary: "The secret that pays for a provider's models, where PatterStage keeps it, and where it never appears"
section: concepts
nav: 50
audience: operator
---

# API key

## What it is

The secret a [provider](provider.md) wants before it will answer. PatterStage
stores each one as a credential: a label you chose, the provider it belongs to,
and the key itself. [Models](model.md) point at a credential rather than
carrying the secret, so rotating a key updates every model that uses it at once.

Listings only ever show a hint, never the key. The stored value is kept in plain
text in your database, which matches how the agent keeps its own keys in its
`.env`, and is worth knowing before you copy that file anywhere.

## What it is not

Not your PatterStage access token. That is the single secret that lets a browser
into this control plane at all, minted on first boot into a file in your data
directory, and it is nothing to do with any provider. Not universally required
either: local and self-hosted providers need no key, so a fully offline install
has none.

## Where you meet it

On the [Models](../guides/models.md) page, beside the models that use it.

## The idea behind it

Treating the key as its own object, rather than a field on a model, is what
makes three ordinary things possible: several models sharing one key, rotating
that key in one place, and never printing it back to the screen. The last one
matters most. A control plane that can show you a secret is a control plane that
can leak it into a screenshot.
