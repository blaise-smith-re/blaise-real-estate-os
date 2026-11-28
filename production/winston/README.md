# Winston Business dashboard

The Business workspace uses the existing owner-private Morning Desk Site for Today, Pipeline and Relationships. Its source, stored through Sites, owns the dashboard, D1 tables and MCP tools. The original Morning Desk home serves the personal workflow. The existing production FUB service restricts access to user 33.

## Deployment and recovery

1. Open the owner-private Morning Desk project in Sites and select its current source version. Winston's dashboard route is `/winston`. Read `/api/winston` through the authorized Site connection to verify its saved source run and observation time.
2. Check the existing 07:15 America/Chicago Morning Desk automation and its persisted receipt. The dashboard reads the saved briefing, transaction and follow-up data. The updater contract includes a complete paged snapshot of assigned people and linked deals. Check the snapshot time separately from the latest briefing time.
3. Run the Winston source tests for event replay, amended deadlines, stage transitions and agent dispatch. Publish changes to the same owner-private Site. Verify the current version and both the private page and API gate.
4. For a specialist handoff, use the private agent's published API channel and hosted secret settings. Follow `docs/workspace-agent-dispatch.md` in the hosted source. An accepted trigger returns a conversation and run reference. Read back the saved specialist result for the source event before recording completion. [Workspace Agent trigger documentation](https://developers.openai.com/workspace-agents/trigger-runs)

Find the governing Agent & Workbench Instructions via the current Drive Source Map. The AI Execution Runbook and the hosted system own dated operating evidence. Private agent links, client examples, API channel identifiers and credentials belong in their authorized systems.
