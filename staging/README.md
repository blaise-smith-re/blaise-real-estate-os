# staging/ — NOT part of the Real Estate OS

Work staged here is **pending extraction to its own repository**. It is not agent logic, not
governance, and not part of this repo's architecture. Nothing here is loaded, imported, or executed
by any agent in this repo.

## Why anything is here at all

`blaise-drive-mcp` is designed to be a **separate repository**:

```
blaise-real-estate-os   orchestration + agents (this repo)
        ↓ consumes
blaise-drive-mcp        the Google Drive / Docs execution adapter
        ↓ REST
Google Drive API v3 · Google Docs API v1
```

It was built that way and committed as its own git repo. Creating the GitHub repository failed:

```
POST https://api.github.com/user/repos
403 Resource not accessible by integration
```

The GitHub App authorizing this session cannot create repositories. Because the build container is
ephemeral, the alternative to staging the code here was losing it.

**This is a preservation measure, not an architectural decision.** The intended architecture is
unchanged, and the build instruction not to embed the connector in this repo still stands.

## Required action

1. Create the private repository `blaise-smith-re/blaise-drive-mcp`.
2. Move `staging/blaise-drive-mcp/` into it as the repo root — it is already a complete working
   tree with its own README, tests, docs and `.gitignore`.
3. Delete `staging/` from this repo.
4. Register the connector as `Blaise_Drive` and wire it per that repo's README.

Until step 3 is done, treat everything under `staging/` as inert.

## State of the staged code

| | |
|---|---|
| Tests | **50/50** — `node staging/blaise-drive-mcp/test/run-all.js` |
| Live certification | **None.** No Google credential exists; no live API call has ever been made. |
| Standing hold | **H-11 in force.** The capability exists; the authority does not. |

See `blaise-drive-mcp/docs/CERTIFICATION.md` for exactly what is and is not proven.
