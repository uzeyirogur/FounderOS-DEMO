import { z } from 'zod';
import type { SopTask } from '@/lib/schemas';

/**
 * SOP playbooks — the rich breakdown behind each SOP task card in the /brain
 * knowledge graph. Larp-first, real-ready: a repo-level lookup keyed by task id,
 * so it can later be swapped for engine/DB-backed data without touching the card.
 *
 * Each SOP decomposes into sub-skills (BREAKS INTO), stands on upstream work
 * (BUILDS ON), states what it displaces (WHAT IT REPLACES), and carries the
 * autonomy ladder (human-led → human-assisted → fully-autonomous), the human's
 * role, build notes, a runnable skill file, and a build status. Skill file
 * bodies are generated dummy SKILL.md for now (the operator: "dummy data for the
 * skills for now").
 */

export const AUTONOMY_LEVELS = ['human-led', 'human-assisted', 'fully-autonomous'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const PLAYBOOK_STATUSES = ['not-started', 'in-development', 'ready-to-run'] as const;
export type PlaybookStatus = (typeof PLAYBOOK_STATUSES)[number];

export const SopPlaybookSchema = z.object({
  autonomy: z.enum(AUTONOMY_LEVELS),
  categoryPath: z.string().min(1),
  description: z.string().min(1),
  breaksInto: z.array(z.string().min(1)).min(1),
  buildsOn: z.array(z.string().min(1)),
  replaces: z.string().min(1),
  ladder: z.object({
    humanLed: z.string().min(1),
    humanAssisted: z.string().min(1),
    fullyAutonomous: z.string().min(1),
  }),
  theHuman: z.string().min(1),
  buildNotes: z.string().min(1),
  skill: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    blurb: z.string().min(1),
  }),
  status: z.enum(PLAYBOOK_STATUSES),
});
export type SopPlaybook = z.infer<typeof SopPlaybookSchema>;

/** A playbook plus the generated runnable skill file, ready for the card. */
export type ResolvedPlaybook = SopPlaybook & { skillMarkdown: string };

const AUTONOMY_LABEL: Record<AutonomyLevel, string> = {
  'human-led': 'HUMAN-LED',
  'human-assisted': 'HUMAN-ASSISTED',
  'fully-autonomous': 'FULLY AUTONOMOUS',
};
export function autonomyLabel(level: AutonomyLevel): string {
  return AUTONOMY_LABEL[level];
}

const STATUS_LABEL: Record<PlaybookStatus, string> = {
  'not-started': 'NOT STARTED',
  'in-development': 'IN DEVELOPMENT',
  'ready-to-run': 'READY TO RUN',
};
export function statusLabel(status: PlaybookStatus): string {
  return STATUS_LABEL[status];
}

// slug -> playbook. One authored entry per seeded SOP (35 total).
const PLAYBOOKS: Record<string, SopPlaybook> = {
  // ── TECH ────────────────────────────────────────────────────────────────
  'sop-conductor': {
    autonomy: 'fully-autonomous',
    categoryPath: 'TECH · Fleet Orchestration',
    description: 'Fan one directive out to every agent, collect the replies, and surface non-responders.',
    breaksInto: ['target-resolver', 'fan-out-dispatch', 'reply-collector'],
    buildsOn: ['Agent Registry', 'Instance Health'],
    replaces: "A $90-120k/year ops lead standing over Slack repeating the same instruction to twelve people.",
    ladder: {
      humanLed: 'You DM each agent the directive and chase replies by hand.',
      humanAssisted: 'The conductor drafts the broadcast and target list; you press send.',
      fullyAutonomous: 'It resolves the targets, fans out, stamps every send, and reports who went dark.',
    },
    theHuman: 'You write the directive and decide who it reaches. The conductor owns delivery and accountability.',
    buildNotes: "Targeting is the whole game: resolve 'the fleet' vs a single pillar before dispatch. Never fail silently, a non-responder after 60s is a report, not a shrug.",
    skill: { name: 'Fleet Broadcaster', slug: 'fleet-broadcaster', blurb: 'Fans a directive out to the whole fleet or one pillar, stamps every send, and reports non-responders.' },
    status: 'ready-to-run',
  },
  'sop-data-agent': {
    autonomy: 'fully-autonomous',
    categoryPath: 'TECH · Knowledge Retrieval',
    description: 'Hybrid search over the second brain with cited passages and honest fallbacks.',
    breaksInto: ['query-parser', 'hybrid-search', 'passage-ranker'],
    buildsOn: ['Vector Index', 'brain-store Sync'],
    replaces: "A $70k/year knowledge manager everyone pings on Slack for 'where's that doc?'",
    ladder: {
      humanLed: 'You grep the brain-store yourself and hope you remember the filename.',
      humanAssisted: 'It returns candidate passages; you decide which actually answer.',
      fullyAutonomous: "It parses, searches, ranks, and returns only cited passages, logging gaps it can't answer.",
    },
    theHuman: 'You own what counts as truth. It never invents a citation and files what it cannot answer as a gap.',
    buildNotes: 'Never invent a source: cited-or-nothing. When Supabase is paused, fall back to local grep instead of failing.',
    skill: { name: 'G-Brain Answerer', slug: 'gbrain-answerer', blurb: 'Hybrid-searches the second brain and returns cited passages, never invented ones.' },
    status: 'ready-to-run',
  },
  'sop-markdown-auditor': {
    autonomy: 'fully-autonomous',
    categoryPath: 'TECH · Knowledge Hygiene',
    description: 'Walk the brain-store, flag broken links and stale docs, and track fix-ups to done.',
    breaksInto: ['link-checker', 'orphan-finder', 'frontmatter-linter'],
    buildsOn: ['brain-store Sync'],
    replaces: 'A part-time knowledge-base janitor that never keeps up.',
    ladder: {
      humanLed: 'You notice broken links only when something 404s in front of a client.',
      humanAssisted: 'It lists the broken links and orphans; you triage.',
      fullyAutonomous: 'It walks every file, scores each folder, and tracks fix-ups to done.',
    },
    theHuman: "You set what 'healthy' means. It enforces the rules and reports the score.",
    buildNotes: "Per-folder scores beat one global number. Track the worst offenders to done, don't just flag them.",
    skill: { name: 'Markdown Auditor', slug: 'markdown-auditor', blurb: 'Walks brain-store, flags broken wiki-links and stale frontmatter, and scores each folder.' },
    status: 'in-development',
  },
  'sop-vector-auditor': {
    autonomy: 'fully-autonomous',
    categoryPath: 'TECH · Index Integrity',
    description: 'Keep pgvector embeddings mirroring brain-store, re-embedding on drift.',
    breaksInto: ['db-waker', 'chunk-differ', 'reembed-trigger'],
    buildsOn: ['brain-store Sync', 'Supabase Project'],
    replaces: 'A data engineer babysitting embedding jobs by hand.',
    ladder: {
      humanLed: 'You assume the index is fine until search quietly returns nothing.',
      humanAssisted: 'It reports chunk drift; you kick off re-embeds.',
      fullyAutonomous: 'It wakes the paused DB, diffs counts, re-embeds drifted docs, and verifies after.',
    },
    theHuman: 'You decide the drift tolerance. It wakes, compares, and heals the index within it.',
    buildNotes: "Free-tier Supabase pauses on idle: wake it and wait for queries before comparing, or you'll read a false zero.",
    skill: { name: 'Vector Index Auditor', slug: 'vector-index-auditor', blurb: 'Diffs pgvector chunk counts against brain-store and triggers re-embeds on drift.' },
    status: 'in-development',
  },
  'sop-notion-sync': {
    autonomy: 'fully-autonomous',
    categoryPath: 'TECH · Source Sync',
    description: 'Pull shared Notion pages into the knowledge core as normalized markdown.',
    breaksInto: ['page-differ', 'block-normalizer', 'core-indexer'],
    buildsOn: ['Notion Integration Token'],
    replaces: 'Copy-pasting Notion docs into the knowledge base by hand.',
    ladder: {
      humanLed: 'You export Notion pages manually when you remember they changed.',
      humanAssisted: 'It flags changed pages; you pull them.',
      fullyAutonomous: 'It diffs, pulls deltas, normalizes to markdown, and records the sync watermark.',
    },
    theHuman: 'You choose which pages the token can see. It keeps them mirrored.',
    buildNotes: 'Watermark every sync so the next run only pulls deltas. Normalize blocks to clean markdown before indexing.',
    skill: { name: 'Notion Mirror', slug: 'notion-mirror', blurb: 'Diffs shared Notion pages and mirrors changed blocks into the knowledge core.' },
    status: 'not-started',
  },
  'sop-stack-monitor': {
    autonomy: 'fully-autonomous',
    categoryPath: 'TECH · Infra Monitoring',
    description: 'Honest up/down for every port, tmux session, and required binary.',
    breaksInto: ['port-prober', 'session-checker', 'flap-detector'],
    buildsOn: [],
    replaces: 'An SRE refreshing a terminal to see if the stack is up.',
    ladder: {
      humanLed: 'You find out a service is down when something breaks downstream.',
      humanAssisted: 'It reports current status; you compare against last time.',
      fullyAutonomous: 'It probes, records honest status, catches flapping, and alerts on a fall.',
    },
    theHuman: "You decide what 'up' requires. It reports the truth, never a fake green.",
    buildNotes: 'Never fake connected. Compare against the last sweep to catch flapping, and alert only on a real state change.',
    skill: { name: 'Local Stack Watch', slug: 'local-stack-watch', blurb: 'Probes ports, tmux sessions and binaries, reporting honest status and flaps.' },
    status: 'ready-to-run',
  },

  // ── COMMUNICATIONS ────────────────────────────────────────────────────────
  'sop-comms-agent': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Communications · Feed Composition',
    description: 'Merge Gmail, WhatsApp and Slack into one ordered, tiered timeline.',
    breaksInto: ['channel-collector', 'timeline-merger', 'urgency-ranker'],
    buildsOn: ['Gmail Triage', 'WhatsApp Monitor', 'Slack Digest'],
    replaces: 'You bouncing between four apps trying to remember who needs a reply.',
    ladder: {
      humanLed: 'You open every app separately and hold the priority in your head.',
      humanAssisted: "It merges the channels; you decide what's urgent.",
      fullyAutonomous: 'It collects, dedupes, tiers by contact, and floats reply-needed to the top.',
    },
    theHuman: 'You act on the feed. It makes sure nothing worth acting on is buried.',
    buildNotes: 'Dedupe across channels before merging. Contact tier drives the sort, not just the timestamp.',
    skill: { name: 'Unified Feed Composer', slug: 'unified-feed-composer', blurb: 'Merges three channels into one tiered timeline with urgent items on top.' },
    status: 'ready-to-run',
  },
  'sop-gmail-worker': {
    autonomy: 'human-assisted',
    categoryPath: 'Communications · Email Triage',
    description: 'Read all four inboxes, classify every thread, and draft replies in your voice.',
    breaksInto: ['imap-reader', 'thread-classifier', 'reply-drafter'],
    buildsOn: ['IMAP Credentials', 'Voice Profile'],
    replaces: 'A $45-55k/year EA triaging your inbox every morning.',
    ladder: {
      humanLed: 'You read all four inboxes yourself and forget which you answered.',
      humanAssisted: 'It classifies threads and drafts replies; you approve before send.',
      fullyAutonomous: 'It clears FYI and waiting-on-us, escalating only what needs your judgment.',
    },
    theHuman: 'You approve every send. It never fires a reply on a real thread without your yes.',
    buildNotes: 'Voice is everything: drafts read from your tone file or they sound like a bot. Client-domain threads also route to the Clients pillar.',
    skill: { name: 'Inbox Triage', slug: 'inbox-triage', blurb: 'Classifies threads across four inboxes and drafts replies in your voice for approval.' },
    status: 'in-development',
  },
  'sop-whatsapp-worker': {
    autonomy: 'human-assisted',
    categoryPath: 'Communications · Chat Monitoring',
    description: 'Read 600+ local chats and surface AA + Vantage team messages with money/deadline flags.',
    breaksInto: ['local-reader', 'sender-tagger', 'risk-flagger'],
    buildsOn: ['Full Disk Access'],
    replaces: "Scrolling 600 chats hoping you didn't miss a client asking a question.",
    ladder: {
      humanLed: 'You scroll WhatsApp and hope nothing important scrolled past.',
      humanAssisted: 'It surfaces team chats and flags money/deadlines; you respond.',
      fullyAutonomous: 'It reads, tags senders, flags risk, and pushes only what matters to the feed.',
    },
    theHuman: 'You reply to people. It makes sure the message that mattered did not get buried under 600 others.',
    buildNotes: 'Read-only, nothing leaves the machine. The read needs Full Disk Access or it hangs, so bound it in a child process.',
    skill: { name: 'WhatsApp Watcher', slug: 'whatsapp-watcher', blurb: 'Reads local WhatsApp storage read-only and surfaces flagged team messages.' },
    status: 'in-development',
  },
  'sop-slack-worker': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Communications · Slack Digest',
    description: 'Summarize every joined channel and separate out mentions and open questions.',
    breaksInto: ['channel-lister', 'digest-writer', 'mention-extractor'],
    buildsOn: ['Slack Bot Token'],
    replaces: 'Reading every channel to find the two messages that needed you.',
    ladder: {
      humanLed: 'You read every channel to find the one that needed you.',
      humanAssisted: 'It digests each channel; you scan the summaries.',
      fullyAutonomous: 'It digests, calls out direct mentions and unanswered questions, and pushes to the feed.',
    },
    theHuman: 'You answer the mentions. It makes sure you see them.',
    buildNotes: 'Separate mentions and unanswered questions from the general digest, they need action, not just awareness.',
    skill: { name: 'Slack Digester', slug: 'slack-digester', blurb: 'Summarizes joined channels and flags mentions and unanswered questions.' },
    status: 'not-started',
  },
  'sop-mia': {
    autonomy: 'human-led',
    categoryPath: 'Communications · Escalations',
    description: 'The human on the threads that need judgment: VIP replies and 24h chases.',
    breaksInto: ['queue-review', 'vip-drafting', 'loop-closing'],
    buildsOn: ['Inbox Triage', 'Unified Feed Composer'],
    replaces: 'Nothing, this is the human backstop the agents escalate to.',
    ladder: {
      humanLed: 'Mia reads the escalation queue and drafts every VIP reply herself.',
      humanAssisted: 'Agents draft VIP replies; Mia edits and sends.',
      fullyAutonomous: 'Not the goal, VIP judgment stays human.',
    },
    theHuman: "Mia owns tone and judgment on anything an agent wasn't confident to send.",
    buildNotes: 'This SOP is deliberately human-led. The skill assists drafting; the send stays with Mia.',
    skill: { name: 'Escalation Handler', slug: 'escalation-handler', blurb: 'Assists a human clearing the escalation queue and chasing stale threads.' },
    status: 'ready-to-run',
  },

  // ── MARKETING / GROWTH ────────────────────────────────────────────────────
  'sop-social-agent': {
    autonomy: 'human-assisted',
    categoryPath: 'Marketing · Content Pipeline',
    description: 'Calendar to briefs to assets to publish queue, gated by an editorial approval.',
    breaksInto: ['calendar-reader', 'creative-briefer', 'asset-qa'],
    buildsOn: ['Content Calendar', 'Brand Voice'],
    replaces: 'A $4-6k/month content coordinator chasing creators for assets.',
    ladder: {
      humanLed: 'You brief creators one by one and assemble the queue manually.',
      humanAssisted: 'It briefs the creative workers and QAs assets; you approve the drop.',
      fullyAutonomous: 'It runs calendar to queue, rejecting off-brand takes with a reason.',
    },
    theHuman: 'Nadia approves every drop. The pipeline fills the queue; the human opens the gate.',
    buildNotes: "Reject off-brand with a one-line reason so the fix is fast. Log what shipped so tomorrow's brief starts warm.",
    skill: { name: 'Content Pipeline Runner', slug: 'content-pipeline-runner', blurb: 'Turns the calendar into briefs, QAs returned assets, and queues approved posts.' },
    status: 'in-development',
  },
  'sop-dmflow-mcp': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Marketing · DM Funnels',
    description: 'Keyword triggers to booked conversations, with hot leads handed to Sales.',
    breaksInto: ['keyword-watcher', 'flow-firer', 'intent-tagger'],
    buildsOn: ['DMFlow API', 'Trigger Keywords'],
    replaces: 'A social VA copy-pasting the same DM reply all day.',
    ladder: {
      humanLed: "You reply to every 'comment X' DM by hand.",
      humanAssisted: 'It fires the flow; you watch conversions.',
      fullyAutonomous: 'It watches keywords, fires flows, tags intent, and hands hot leads to Sales.',
    },
    theHuman: 'You design the funnel and offer. It runs the triggers and routing.',
    buildNotes: 'Tag subscribers by intent as they move so Sales gets context, not just a name. Report conversions to the dashboard.',
    skill: { name: 'DM Funnel Automator', slug: 'dm-funnel-automator', blurb: 'Fires DMFlow flows on keyword triggers and routes hot leads to Sales.' },
    status: 'ready-to-run',
  },
  'sop-nadia': {
    autonomy: 'human-led',
    categoryPath: 'Marketing · Editorial',
    description: 'The human editorial gate: sets the angles, approves or kills every drop.',
    breaksInto: ['performance-review', 'angle-setting', 'drop-approval'],
    buildsOn: ['Content Pipeline Runner'],
    replaces: 'Nothing, this is the taste layer the pipeline reports into.',
    ladder: {
      humanLed: 'Nadia sets angles and approves every asset before it ships.',
      humanAssisted: 'Agents propose angles from performance; Nadia decides.',
      fullyAutonomous: 'Not the goal, editorial taste stays human.',
    },
    theHuman: 'Nadia owns what gets published and why. The agents fill the queue; he opens the gate.',
    buildNotes: 'Deliberately human-led. The skill surfaces performance and proposes angles; the kill/approve stays with Nadia.',
    skill: { name: 'Editorial Gate', slug: 'editorial-gate', blurb: "Surfaces last cycle's numbers and proposed angles for a human approve/kill." },
    status: 'ready-to-run',
  },

  // ── SALES ─────────────────────────────────────────────────────────────────
  'sop-sales-agent': {
    autonomy: 'human-assisted',
    categoryPath: 'Sales · Pipeline Ops',
    description: 'Every open deal inspected daily; stalled deals get a next action and an owner.',
    breaksInto: ['deal-puller', 'stall-detector', 'call-briefer'],
    buildsOn: ['Ledger CRM CRM', 'Payment Links'],
    replaces: 'A $60-80k/year sales ops manager keeping the board clean.',
    ladder: {
      humanLed: 'You eyeball the board when you remember and hope nothing stalled.',
      humanAssisted: 'It ranks stalled deals and briefs the closer; you work them.',
      fullyAutonomous: 'It inspects, attaches next actions, preps payment links, and logs stage changes same-day.',
    },
    theHuman: 'Marco works the deals. The agent makes sure none go quiet unnoticed.',
    buildNotes: 'Past 7 days in stage = stalled. Prep payment links across PayKit/Stripe/FlexPay before calls, not during.',
    skill: { name: 'Pipeline Keeper', slug: 'pipeline-keeper', blurb: 'Ranks stalled deals, attaches next actions, and briefs the closer daily.' },
    status: 'in-development',
  },
  'sop-sales-calls-data': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Sales · Call Intelligence',
    description: 'Every Fathom call becomes CRM intelligence: objections, commitments, next steps.',
    breaksInto: ['fathom-ingest', 'objection-extractor', 'crm-writer'],
    buildsOn: ['Fathom', 'Ledger CRM CRM'],
    replaces: 'A closer typing call notes from memory after every call.',
    ladder: {
      humanLed: 'You write call notes from memory, if you write them at all.',
      humanAssisted: 'It extracts objections and next steps; you file them.',
      fullyAutonomous: 'It ingests each call, extracts the intel, and writes it back to Ledger CRM.',
    },
    theHuman: 'You run the conversation. It captures what was said and what to do next.',
    buildNotes: 'Tag calls where pricing or competitors came up, those patterns feed the pipeline brief.',
    skill: { name: 'Call Miner', slug: 'call-miner', blurb: 'Turns Fathom recordings into objections, commitments and next steps in Ledger CRM.' },
    status: 'in-development',
  },
  'sop-marco': {
    autonomy: 'human-led',
    categoryPath: 'Sales · Closing',
    description: 'The human on the phone from hello to signed.',
    breaksInto: ['precall-review', 'discovery-script', 'objection-handling'],
    buildsOn: ['Pipeline Keeper', 'Call Miner'],
    replaces: 'Nothing, this is the closer the whole lane feeds.',
    ladder: {
      humanLed: 'Marco runs every call live from brief to signature.',
      humanAssisted: 'Agents prep the brief and objections; Marco runs the call.',
      fullyAutonomous: 'Not the goal, closing stays human.',
    },
    theHuman: 'Marco owns the conversation and the close. Never improvise pricing, use the objection sheet.',
    buildNotes: "Deliberately human-led. The skill preps the brief and last three touches; the call is Marco's.",
    skill: { name: 'Close Call Runner', slug: 'close-call-runner', blurb: 'Preps the pre-call brief and objection sheet for a human closer.' },
    status: 'ready-to-run',
  },

  // ── FINANCES ──────────────────────────────────────────────────────────────
  'sop-stripe': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Finance · Income Tracking',
    description: 'Stripe balance and charges labeled AA, anomalies flagged, payouts noted.',
    breaksInto: ['balance-puller', 'income-labeler', 'anomaly-flagger'],
    buildsOn: ['Stripe Key'],
    replaces: 'Checking the Stripe dashboard by hand for the AA total.',
    ladder: {
      humanLed: 'You open Stripe and eyeball the balance.',
      humanAssisted: 'It pulls charges; you label and reconcile.',
      fullyAutonomous: 'It pulls balance and charges, labels AA, flags anomalies, and notes payouts.',
    },
    theHuman: 'You own the reconciliation. It keeps the income chart current.',
    buildNotes: 'Needs a live key with balance+charges read (restricted keys 403 without it). Flag anomalies against the trailing average.',
    skill: { name: 'Stripe Income Tracker', slug: 'stripe-income-tracker', blurb: 'Pulls Stripe balance and charges, labels income, and flags anomalies.' },
    status: 'in-development',
  },
  'sop-processor-confirm': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Finance · Payment Verification',
    description: 'No deal marked paid without an API receipt from the claimed processor.',
    breaksInto: ['claim-receiver', 'api-verifier', 'audit-writer'],
    buildsOn: ['Processor Registry'],
    replaces: "Taking a salesperson's word that a deal was paid.",
    ladder: {
      humanLed: "You trust the 'they paid' Slack message and hope it's true.",
      humanAssisted: 'It checks the processor; you record the result.',
      fullyAutonomous: 'It receives the claim, verifies the charge, and writes confirmation or flags loudly.',
    },
    theHuman: 'You resolve genuine disputes. It refuses to mark paid without a receipt.',
    buildNotes: 'Confirm-or-flag-loudly, never silently pass. Keep an audit trail of every confirmation for month-end.',
    skill: { name: 'Payment Confirmer', slug: 'payment-confirmer', blurb: 'Verifies a payment claim against the processor API before marking a deal paid.' },
    status: 'ready-to-run',
  },
  'sop-payments-pulse': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Finance · Processor Monitoring',
    description: 'Every processor pinged, honest status recorded, downtime alerted.',
    breaksInto: ['registry-pinger', 'status-recorder', 'recovery-checker'],
    buildsOn: ['Processor Registry'],
    replaces: 'Finding out a processor is down when a payment fails.',
    ladder: {
      humanLed: 'You learn a processor is down from a failed charge.',
      humanAssisted: 'It reports status; you watch for outages.',
      fullyAutonomous: 'It pings each processor, records honest status, alerts on downtime, and rechecks until recovery.',
    },
    theHuman: 'You decide what to do on an outage. It makes sure you know the moment one starts.',
    buildNotes: 'Never fake connected. Recheck failed processors on a tighter cadence and keep uptime history for analytics.',
    skill: { name: 'Processor Health Watch', slug: 'processor-health-watch', blurb: 'Pings every processor, records honest status, and alerts on downtime.' },
    status: 'ready-to-run',
  },
  'sop-dana': {
    autonomy: 'human-led',
    categoryPath: 'Finance · Monthly Close',
    description: "The human sign-off on every month's numbers and the P&L.",
    breaksInto: ['statement-import', 'transaction-categorize', 'pnl-delivery'],
    buildsOn: ['PayKit Income Tracker', 'Stripe Income Tracker'],
    replaces: 'A $50-70/hr bookkeeper or a monthly accountant fee.',
    ladder: {
      humanLed: 'Dana imports statements and reconciles the month by hand.',
      humanAssisted: 'Agents pre-categorize; Dana reconciles and signs off.',
      fullyAutonomous: 'Not the goal, the month-end sign-off stays human.',
    },
    theHuman: 'Dana owns the numbers the operator sees. Reconcile against what the agents recorded, chase every gap.',
    buildNotes: "Deliberately human-led. The skill imports statements and pre-categorizes; reconciliation and the P&L commentary are Dana's.",
    skill: { name: 'Monthly Close', slug: 'monthly-close', blurb: 'Imports statements and pre-categorizes for a human month-end reconciliation.' },
    status: 'in-development',
  },

  // ── CLIENTS ───────────────────────────────────────────────────────────────
  'sop-client-roster': {
    autonomy: 'fully-autonomous',
    categoryPath: 'Clients · Roster',
    description: 'One always-current list of every client, health-marked with a reason.',
    breaksInto: ['source-puller', 'health-marker', 'delta-publisher'],
    buildsOn: ['Ledger CRM CRM', 'PayKit API'],
    replaces: 'A stale client spreadsheet nobody trusts.',
    ladder: {
      humanLed: 'You keep a client list you update when you remember.',
      humanAssisted: 'It reconciles sources; you mark health.',
      fullyAutonomous: 'It pulls sources daily, marks active/at-risk/churned with a reason, and publishes deltas.',
    },
    theHuman: 'You act on at-risk accounts. It makes sure the list is never wrong.',
    buildNotes: 'Every health mark needs a reason, not just a color. Note the deltas so changes are visible.',
    skill: { name: 'Client Roster Keeper', slug: 'client-roster-keeper', blurb: 'Reconciles client sources daily and marks account health with a reason.' },
    status: 'in-development',
  },
  'sop-client-onboarding': {
    autonomy: 'human-assisted',
    categoryPath: 'Clients · Onboarding',
    description: 'Closed-won to kickoff without a dropped step, payment verified first.',
    breaksInto: ['welcome-pack', 'workspace-setup', 'kickoff-booker'],
    buildsOn: ['Payment Confirmer', 'Notion Mirror'],
    replaces: 'A $50-60k/year onboarding coordinator running a checklist.',
    ladder: {
      humanLed: 'You run the onboarding checklist manually per client.',
      humanAssisted: 'It runs the steps; you confirm access and hand off.',
      fullyAutonomous: 'It triggers on closed-won, verifies payment, ships the pack, and books kickoff.',
    },
    theHuman: 'Rae owns the relationship handoff. The agent runs the mechanical checklist without dropping a step.',
    buildNotes: 'Verify payment landed BEFORE anything ships. Collect all access in one request, not five follow-ups.',
    skill: { name: 'Client Onboarder', slug: 'client-onboarder', blurb: 'Runs the closed-won-to-kickoff checklist, payment-gated, without dropped steps.' },
    status: 'in-development',
  },
  'sop-client-success': {
    autonomy: 'human-assisted',
    categoryPath: 'Clients · Success',
    description: 'Cadence, deliverables and renewals on rails, health scored monthly.',
    breaksInto: ['cadence-runner', 'scope-tracker', 'renewal-flagger'],
    buildsOn: ['Client Roster Keeper', 'Call Miner'],
    replaces: 'A $55-70k/year CSM juggling check-ins in their head.',
    ladder: {
      humanLed: 'You check in with clients when you can and hope scope holds.',
      humanAssisted: 'It tracks cadence and scope; you run the calls.',
      fullyAutonomous: 'It runs the cadence, flags slippage, scores health, and raises renewals 30 days out.',
    },
    theHuman: 'Rae runs the relationship. The agent makes sure no week and no renewal slips.',
    buildNotes: 'No skipped weeks in the cadence. Raise renewals and upsells 30 days out, not at expiry.',
    skill: { name: 'Client Success Runner', slug: 'client-success-runner', blurb: 'Runs the check-in cadence, tracks scope, and flags renewals 30 days out.' },
    status: 'not-started',
  },
  'sop-rae': {
    autonomy: 'human-led',
    categoryPath: 'Clients · Accounts',
    description: 'The human accountable for every account: kickoffs, QBRs, escalations, renewals.',
    breaksInto: ['qbr-runner', 'escalation-resolver', 'renewal-signoff'],
    buildsOn: ['Client Success Runner'],
    replaces: 'Nothing, this is the accountable human every account rolls up to.',
    ladder: {
      humanLed: 'Rae runs kickoffs, QBRs and escalations personally.',
      humanAssisted: 'Agents prep health scores and materials; Rae runs the calls.',
      fullyAutonomous: 'Not the goal, account accountability stays human.',
    },
    theHuman: 'Rae owns every account relationship. Resolve escalations same-day, approve scope before work starts.',
    buildNotes: "Deliberately human-led. The skill preps QBR materials and health reviews; the relationship stays Rae's.",
    skill: { name: 'Account Owner', slug: 'account-owner', blurb: 'Preps QBR materials and health reviews for the accountable human.' },
    status: 'ready-to-run',
  },
};

/** A safe generated fallback so any SOP without an authored entry still renders
 *  a full card (keeps every task covered even if the seed grows). */
function fallbackPlaybook(task: SopTask): SopPlaybook {
  const human = task.assigneeKind === 'person';
  return {
    autonomy: human ? 'human-led' : 'fully-autonomous',
    categoryPath: 'Operations · SOP',
    description: task.summary,
    breaksInto: ['intake', 'execute', 'report'],
    buildsOn: [],
    replaces: 'Manual effort a person would otherwise repeat by hand.',
    ladder: {
      humanLed: 'A person runs every step by hand.',
      humanAssisted: 'The agent does the work; a human approves the output.',
      fullyAutonomous: 'The agent runs the whole SOP end to end and reports.',
    },
    theHuman: human
      ? 'This SOP is owned by a human; the skill assists, it does not replace the call.'
      : 'A human sets the goal and reviews the output; the agent executes.',
    buildNotes: 'Wire the real steps from the SOP checklist into the skill below.',
    skill: {
      name: `${task.title} Skill`,
      slug: task.id.replace(/^sop-/, '').replace(/[^a-z0-9-]/g, '-'),
      blurb: task.summary,
    },
    status: 'not-started',
  };
}

/** Generate the dummy-but-runnable SKILL.md body from the playbook + SOP.
 *  Real skill wiring lands later; this reads like the file it will become. */
export function skillFileMarkdown(pb: SopPlaybook, task: SopTask): string {
  const steps = task.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const buildsOn = pb.buildsOn.length ? pb.buildsOn.map((b) => `- ${b}`).join('\n') : '- nothing upstream';
  return `---
name: ${pb.skill.slug}
title: ${pb.skill.name}
description: ${pb.skill.blurb}
autonomy: ${pb.autonomy}
status: ${pb.status}
---

# ${pb.skill.name}

${pb.description}

## When to run
${task.summary}

## Breaks into
${pb.breaksInto.map((s) => `- ${s}`).join('\n')}

## Builds on
${buildsOn}

## Procedure
${steps}

## The human in the loop
${pb.theHuman}

## Build notes
${pb.buildNotes}

> Dummy skill file. The steps above mirror the live SOP; wire the runnable
> implementation here when this skill is promoted from ${pb.status}.
`;
}

/** Resolve the full, card-ready playbook for a SOP task (authored or fallback),
 *  including the generated runnable skill file. */
export function playbookFor(task: SopTask): ResolvedPlaybook {
  const pb = PLAYBOOKS[task.id] ?? fallbackPlaybook(task);
  return { ...pb, skillMarkdown: skillFileMarkdown(pb, task) };
}
