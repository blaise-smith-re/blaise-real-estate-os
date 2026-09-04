# Tool Policy — Blaise Real Estate OS Execution Layer

> **CURRENT RUNTIME PRECEDENCE — 2026-09-04:** Project Codex enables separate FUB read and full
> operator services. `lead-conversion-crm` may autonomously maintain Blaise's individual FUB records.
> Blaise reviews before SEND / SUBMIT / PUBLISH / SIGN / SPEND. Shared team infrastructure remains
> outside this grant.

**Status:** Read + internal maintenance · Effective 2026-09-04
**Enforcement:** `.claude/settings.json` (deny list) + per-agent `tools:` allowlist in frontmatter.
**Authority:** `SOP - Claude Execution Operator, Browser & API-MCP Integration Control` v4.27 §5B, §6.

> **Certification is action-class specific.** A PASS for one tool or workflow does not authorize every
> tool on the same connector or every action on the same site. — Execution Operator SOP §5B

---

## 1. Permission classes

| Class | Definition | Phase 2 agents |
|---|---|---|
| **READ** | Retrieval and analysis only. No state change anywhere. | ✅ granted, narrowly |
| **INTERNAL MAINTENANCE** | Exact-contact FUB record update with server-side validation and read-back. | ✅ CRM service only |
| **EXTERNAL-ACTION REVIEW** | SEND / SUBMIT / PUBLISH / SIGN / SPEND. | Blaise reviews final product |
| **HOLD / PROHIBITED** | Not permitted under any current authorization. | — |

Read-only departments remain read-only. Their CRM outcomes route to the one write-capable service.

---

## 2. Blaise FUB MCP — 38 tools

Verified 2026-08-31: the live connector exposes exactly **38 tools**, matching the Execution Operator
SOP §5B register. **25 read · 13 write.** All 13 bounded write tools are granted only to
`lead-conversion-crm` for internal record maintenance.

### READ (25) — granted to Phase 2 agents as listed in §5

`find_contact` · `get_contact` · `get_contact_events` · `get_contact_notes` · `get_contact_calls` ·
`get_contact_text_messages` · `get_contact_appointments` · `get_task` · `get_open_tasks` ·
`search_tasks` · `get_active_deals` · `get_deal` · `search_deals` · `get_deal_custom_fields` ·
`get_pipelines` · `get_stages` · `get_timeframes` · `get_user` · `get_users` · `get_custom_fields` ·
`get_appointment` · `get_appointment_types` · `get_appointment_outcomes` ·
`audit_contact_daily_control` · `audit_contacts_daily_control_batch`

### INTERNAL MAINTENANCE (13) — **ACTIVE through the CRM service**

`create_contact_note` · `create_contact_task` · `close_out_contact_interaction` ·
`create_contact_appointment` · `update_contact_appointment` · `create_contact_deal` ·
`update_contact_deal` · `update_contact_profile` · `update_contact_task` · `replace_contact_channels` ·
`merge_contact_tags` · `log_external_call_record` · `log_external_text_record`

The runtime binds every write to the resolved contact, forces live execution, enforces a two-write
maximum, records actual effects, and relies on the FUB server's duplicate checks and independent
read-back. Appointment invitations are forced off at this boundary. `merge_contact_tags` retains its
team-approval field because tag usage affects shared governance.

### HOLD / PROHIBITED — FUB

- Shared stages, Smart Lists, action plans, automations, lead-flow rules, team templates.
  **Requires Brent's approval** (BOM §16). Never from this repository.
- **All FUB browser automation.** Follow Up Boss's Acceptable Use Policy prohibits unauthorized
  scripting/automation. The authenticated API/MCP route is the only operating lane.

### Required retrieval control

`search_tasks` completeness (PR #2, Execution SOP v4.27): use `due_on` / `due_from` / `due_to` with
`due_timezone=America/Chicago`; use `fetch_all` for the complete set; verify `_completeness`
(`returned_count == total_count`, `has_more == false`, `capped == false`) **before claiming
completeness**. The legacy `due` keyword is compatibility-only and is **not** completeness-safe.

### Known connector limitation — contact resolution

**Verified live 2026-08-31 (IF-2026-08-31-010).** `find_contact` **silently excludes Trash-stage
records.** Last-name matching works correctly; the exclusion is by stage. A contact in Trash returns
`total: 0` by name even when the record exists, is assigned, carries open tasks, and shows current IDX
activity.

**Consequence:** `total: 1` means *one non-Trash match*, never *one match*. Any agent whose
wrong-target guard depends on a unique-match count must corroborate identity through a second
independent path — the `personId` on the triggering task/appointment, an exact email/phone match, or
matching relationship facts in the notes. `total: 0` never establishes that a contact does not exist.

### Communication boundary

`log_external_text_record` and `log_external_call_record` **record** external activity. They do not
send a text or place a call. **No tool on the current connector independently sends SMS, email, or
places calls.** Never describe them as communication tools.

---

## 3. Google Drive

| Class | Scope |
|---|---|
| **READ** ✅ | `search_files`, `read_file_content`, `get_file_metadata`, `download_file_content` — canonical source retrieval by `file_id` |
| **HUMAN-APPROVAL WRITE** ❌ | `create_file`, `update_file`, `copy_file` — any new or modified Drive asset |
| **HOLD** ❌ | `trash_file`, `share_file` — destructive / access-granting |
| **PROHIBITED** | Editing the Business Operating Manual or any SOP. ChatGPT / 04 owns canonical change control. |

Phase 2 agents receive **read tools only**. No Drive business-record writes.

---

## 4. Google Calendar

| Class | Scope |
|---|---|
| **READ** ✅ | `list_calendars`, `list_events`, `search_events`, `get_event` |
| **HOLD** ❌ | `create_event`, `update_event`, `delete_event`, `respond_to_event`, `suggest_time` |

Only **synthetic** `create_event` passed Phase 1 certification (Execution SOP, Calendar lane). **No
production Calendar write is certified.** Phase 2 grants read only.

**Privacy control:** prefer exact-title plus bounded-time queries. Broad day listings may return full
unrelated event details; if unrelated data is unavoidably returned, do not inspect, summarize, or
reproduce it beyond confirming the target.

**Timezone control:** do not trust `get_event`'s rendered offset alone when it conflicts with the IANA
zone. Reconcile absolute instant + IANA zone + expected America/Chicago local offset. See the
`chicago-date-anchor` skill.

---

## 5. Gmail — **NOT GRANTED IN PHASE 2**

Every Gmail tool is withheld from both Phase 2 agents.

- Only **synthetic draft creation** passed Phase 1, **with no independent read-back** — the certified
  toolset exposed no `get_draft` equivalent, so draft content is recorded as *submitted, not verified*.
- Production Gmail reads are certified only for a *specifically authorized low-stakes internal event*.
- Send / reply / forward / attachments / labels / trash / spam — **HOLD**.

Both canonical prompts permit narrow Gmail reads *when materially relevant*. **Phase 2 deliberately
withholds the capability entirely** rather than granting a tool the agents are told to almost never
use. Where a run would benefit from Gmail, the agent must disclose the gap under
`MISSING INFORMATION` — not attempt the read.

> **Improvement Finding IF-2026-08-31-004** records that the live Gmail connector now exposes
> `get_draft` / `list_drafts`, which may resolve the read-back limitation. That is a re-test
> opportunity for a future phase, not authority for Phase 2.

---

## 6. Composio / Instagram — **NOT GRANTED IN PHASE 2**

Read-only Instagram intelligence is certified for the future Market Intelligence & Marketing
department. **Not required by either Phase 2 agent; therefore not granted.**
Publish / edit / delete / message / comment / follow — **HOLD** at every tier.

---

## 7. Systems not reachable from this repository

**Claude Code has no browser lane.** These are Claude-in-Chrome lanes and cannot be operated here
regardless of certification status:

| System | Certified status (Chrome lane) | Here |
|---|---|---|
| Northstar MLS / Matrix | Production read/search/market-intelligence — CERTIFIED | ❌ unreachable |
| Click Contracts | Sanitized preparation through Review — CERTIFIED | ❌ unreachable |
| SkySlope | Sanitized test-record read-only mapping | ❌ unreachable |
| Ylopo | No certified lane; vendor terms prohibit automated access | ❌ unreachable |
| ShowingTime | No certified lane | ❌ unreachable |

An agent must **disclose the gap and route to the Chrome operator** — never simulate, infer, or
substitute remembered data. See `docs/CHROME-OPERATOR-HANDOFF.md`.

---

## 8. Scheduling / unattended execution — **HOLD**

No agent may be given a scheduling tool. No cron, Routine, scheduled task, background job, or `/loop`
for agent execution.

The Execution Operator SOP v4.27 holds unattended Command Center execution pending a
scheduler-runtime morning smoke proving: (1) the America/Chicago runtime date anchor; (2) production
FUB + Calendar reachability; (3) complete task retrieval passing `_completeness`; (4) correct report
generation; (5) zero writes and zero external communication; (6) reliable delivery.

> **This repository has scheduling capability. That capability must not be used for agent
> execution.** Standing up an agent here on a schedule would silently defeat an active certification
> gate. Both agents are **manual invocation only**.

A reminder that merely tells Blaise to run the report is **not** unattended execution and is **not**
equivalent to one.

---

## 9. Per-agent granted tool surface (Phase 2)

### `daily-revenue-command-center` — 25 grants: 24 MCP read tools + `Skill`

**FUB (17):** `get_open_tasks`, `search_tasks`, `get_task`, `find_contact`, `get_contact`,
`get_contact_notes`, `get_contact_events`, `get_contact_calls`, `get_contact_text_messages`,
`get_contact_appointments`, `get_active_deals`, `search_deals`, `get_deal`, `get_stages`, `get_users`,
`audit_contact_daily_control`, `audit_contacts_daily_control_batch`
**Calendar (4, read):** `list_calendars`, `list_events`, `search_events`, `get_event`
**Drive (3, read):** `search_files`, `read_file_content`, `get_file_metadata`

### `client-prep-brief` — 25 grants: 24 MCP read tools + `Skill`

**FUB (17):** `find_contact`, `get_contact`, `get_contact_notes`, `get_contact_events`,
`get_contact_calls`, `get_contact_text_messages`, `get_contact_appointments`, `get_appointment`,
`get_open_tasks`, `search_tasks`, `get_task`, `get_stages`, `get_timeframes`, `get_active_deals`,
`get_deal`, `get_users`, `get_user`
**Calendar (4, read):** `list_calendars`, `list_events`, `search_events`, `get_event`
**Drive (3, read):** `search_files`, `read_file_content`, `get_file_metadata`

**`Skill` is granted to both agents (D-009).** Skills are instructions, not capabilities — a skill
cannot grant a tool, so this cannot widen the tool surface. It is required for the three shared skills
to be loadable.

Neither agent receives Gmail, Composio, `Bash`, `Write`, `Edit`, `Task`/`Agent`, or any scheduling
tool. Verified by tests T-10, T-11 and T-12.

---

## 9A. Department tool surfaces (Phases 3–8)

All six new departments hold **read tools only**. No write tool of any connector is granted to any
agent in this repository.

| Agent | FUB | Calendar | Drive | Writes |
|---|---|---|---|---|
| `lead-conversion-crm` | 18 read + 2 audit | read (optional) | read | **none granted** — 3 certified classes gated on CGQ-001 |
| `buyer-investor-ops` | 18 read | read | read | none |
| `seller-listing-ops` | 18 read | read | read | none |
| `market-intel-marketing` | 18 read | read (optional) | read | none |
| `transaction-closing-ops` | 18 read | read | read | none |
| `chief-of-staff` | 18 read | read | read | none |

**The write gate is structural.** Exec SOP v4.28 §1B-1: no build, test, merge or deployment grants FUB
write authority without a separate canonical control. That control does not exist, so the tools stay
absent from every grant **and** denied at project level. `lead-conversion-crm` runs the
controlled-write sequence through step 11 and emits a `CRM WRITE REQUEST` packet.

Gmail, Composio, `Bash`, `Write`, `Edit`, `Task`/`Agent` and every scheduling tool are withheld from
all eight agents.

## 10. Change control for this file

Changing a permission class in this file is an **OPERATIONAL CHANGE**. It requires an Improvement
Finding, a corresponding `.claude/settings.json` change, a test update, and ChatGPT / 04 review before
the corresponding Drive certification register is amended. **Never widen a grant in a commit without a
recorded finding.**
