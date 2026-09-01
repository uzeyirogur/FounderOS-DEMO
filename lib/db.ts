import Database from 'better-sqlite3';
import { isValidCron } from '@/lib/cron';
import {
  AgentCronSchema,
  AgentMessageSchema,
  AgentRunSchema,
  ErrorLogSchema,
  AgentSchema,
  AgentTaskSchema,
  BroadcastReplySchema,
  BroadcastSchema,
  CapabilityProviderSchema,
  ClaudeCodeRunSchema,
  ContactTagSchema,
  ContentPieceSchema,
  CreativeBriefSchema,
  DelegatedTaskSchema,
  DepartmentSchema,
  DomainSchema,
  GrowthBriefSchema,
  IdeaSchema,
  LifecycleApprovalSchema,
  LifecycleEvidenceSchema,
  LifecycleTaskSchema,
  MetricSchema,
  NotificationSchema,
  OutboundMessageSchema,
  PersonaSchema,
  PersonalTaskSchema,
  ProjectLifecycleStateSchema,
  PhaseSchema,
  ProjectSchema,
  PublishPlanSchema,
  RoadmapItemSchema,
  RoutineSchema,
  RoutineCompletionSchema,
  SocialAccountSchema,
  SocialSnapshotSchema,
  EmailListSnapshotSchema,
  SocialDmSchema,
  SocialDmSnapshotSchema,
  SocialDmMessageSchema,
  SocialPostSchema,
  FunnelContactSchema,
  FunnelTouchSchema,
  FunnelJourneySchema,
  PersonSchema,
  LeadMagnetSchema,
  type LeadMagnet,
  SopTaskSchema,
  WorkflowSchema,
  SkillSchema,
  ToolSchema,
  type Agent,
  type AgentCron,
  type AgentMessage,
  type AgentRun,
  type ErrorLog,
  type AgentTask,
  type Broadcast,
  type BroadcastReply,
  type CapabilityProvider,
  type ClaudeCodeRun,
  type ContactTag,
  type ContentPiece,
  type CreativeBrief,
  type DelegatedTask,
  type Department,
  type Domain,
  type GrowthBrief,
  type Idea,
  type LifecycleApproval,
  type LifecycleEvidence,
  type LifecycleTask,
  type Metric,
  type Notification,
  type OutboundMessage,
  type Persona,
  type PersonalTask,
  type Phase,
  type Project,
  type ProjectLifecycleState,
  type PublishPlan,
  type Routine,
  type RoutineCompletion,
  type RoadmapItem,
  type SocialAccount,
  type SocialPlatform,
  type SocialSnapshot,
  type EmailListSnapshot,
  type SocialDm,
  type SocialDmSnapshot,
  type SocialDmMessage,
  type SocialPost,
  type FunnelContact,
  type FunnelTouch,
  type FunnelJourney,
  type FunnelVenture,
  type Person,
  type SopTask,
  type Workflow,
  type Skill,
  type Tool,
} from '@/lib/schemas';

const DDL = `
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL,
  "order" INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  tier TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  tools TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS roadmap_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  quarter TEXT NOT NULL,
  status TEXT NOT NULL,
  department_id TEXT,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  delta REAL NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  color TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  ord INTEGER NOT NULL,
  name TEXT NOT NULL,
  archetype TEXT NOT NULL,
  tagline TEXT NOT NULL,
  summary TEXT NOT NULL,
  accent TEXT NOT NULL,
  north_star TEXT NOT NULL,
  pillars TEXT NOT NULL DEFAULT '[]',
  connectors TEXT NOT NULL DEFAULT '[]',
  metrics TEXT NOT NULL DEFAULT '[]',
  brain_use TEXT NOT NULL,
  signature_play TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS phases (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  context TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_crons (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  schedule TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_run_at TEXT
);
CREATE TABLE IF NOT EXISTS contact_tags (
  person TEXT NOT NULL,
  channel TEXT NOT NULL,
  tag TEXT NOT NULL,
  tier INTEGER NOT NULL,
  PRIMARY KEY (person, channel)
);
CREATE TABLE IF NOT EXISTS social_accounts (
  platform TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  url TEXT,
  "order" INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS social_snapshots (
  platform TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  followers INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (platform, captured_at)
);
CREATE TABLE IF NOT EXISTS broadcast_replies (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id),
  agent_id TEXT NOT NULL,
  ok INTEGER NOT NULL,
  reply TEXT NOT NULL DEFAULT '',
  finished_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_list_snapshots (
  captured_at TEXT PRIMARY KEY,
  subscribers INTEGER NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_dms (
  platform TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS social_dm_snapshots (
  platform TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  count INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (platform, captured_at)
);
CREATE TABLE IF NOT EXISTS social_dm_messages (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  name TEXT NOT NULL,
  handle TEXT,
  text TEXT NOT NULL,
  direction TEXT NOT NULL,
  tag TEXT,
  ts TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_dm_messages_ts ON social_dm_messages (ts);
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  caption TEXT NOT NULL,
  media_url TEXT,
  platforms TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_for TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  tools TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS lead_magnets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  offer TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  captures TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  launched_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'seed'
);
CREATE TABLE IF NOT EXISTS sop_tasks (
  id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES departments(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  assignee_kind TEXT NOT NULL,
  assignee_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS funnel_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venture TEXT NOT NULL,
  status TEXT NOT NULL,
  product TEXT,
  amount_usd REAL,
  relationship TEXT NOT NULL DEFAULT 'warm',
  likelihood INTEGER NOT NULL DEFAULT 50,
  email TEXT,
  phone TEXT,
  person TEXT,
  company TEXT,
  role TEXT,
  linkedin TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS funnel_touches (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES funnel_contacts(id),
  seq INTEGER NOT NULL,
  stage TEXT NOT NULL,
  channel TEXT NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  revenue_usd INTEGER NOT NULL DEFAULT 0,
  ord INTEGER NOT NULL DEFAULT 0,
  steps TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  tools TEXT NOT NULL DEFAULT '[]',
  markdown TEXT NOT NULL DEFAULT '',
  ord INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  path_or_url TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  permission_level TEXT NOT NULL DEFAULT 'read_only',
  authorized_agent_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  origin TEXT NOT NULL DEFAULT 'seed'
);
CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  market_size INTEGER NOT NULL,
  effort INTEGER NOT NULL,
  strategic_fit INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  project_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  channel TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL,
  sent_at TEXT,
  decided_at TEXT,
  decided_by TEXT,
  response_text TEXT
);
CREATE TABLE IF NOT EXISTS project_lifecycle_state (
  project_id TEXT PRIMARY KEY,
  current_phase TEXT NOT NULL DEFAULT 'idea',
  history TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lifecycle_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  responsible_agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  blocked_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lifecycle_approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  requested_by_agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS lifecycle_evidence (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  kind TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  recorded_by_agent_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capability TEXT NOT NULL,
  type TEXT NOT NULL,
  connector TEXT,
  auth_required INTEGER NOT NULL DEFAULT 0,
  cost_model TEXT NOT NULL DEFAULT 'unknown',
  free_tier TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  installed INTEGER NOT NULL DEFAULT 0,
  configured INTEGER NOT NULL DEFAULT 0,
  approved_by_user INTEGER NOT NULL DEFAULT 0,
  allowed_agents TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  last_verified_at TEXT
);
CREATE TABLE IF NOT EXISTS content_pieces (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  kind TEXT NOT NULL,
  brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafted',
  output TEXT,
  required_capability TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_briefs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  focus TEXT NOT NULL,
  query TEXT NOT NULL,
  findings TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publish_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  content_piece_id TEXT NOT NULL,
  platforms TEXT NOT NULL DEFAULT '[]',
  adaptations TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'drafted',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  published_at TEXT,
  failure_reason TEXT
);
CREATE TABLE IF NOT EXISTS outbound_messages (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafted',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  sent_at TEXT,
  failure_reason TEXT
);
CREATE TABLE IF NOT EXISTS personal_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  due_at TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS routine_completions (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL,
  completed_on TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE(routine_id, completed_on)
);
CREATE TABLE IF NOT EXISTS creative_briefs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  format TEXT NOT NULL,
  query TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delegated_tasks (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  project_id TEXT,
  assigned_agent_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  dependencies TEXT NOT NULL DEFAULT '[]',
  approval_requirement TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  result_summary TEXT,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS claude_code_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  project_dir TEXT NOT NULL,
  prompt TEXT NOT NULL,
  permission_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  result_summary TEXT,
  error TEXT,
  total_cost_usd REAL,
  qa_report TEXT
);
`;

/** Databases created before the hierarchy build lack these columns. */
function migrateAgentsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(agents)') as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('parent_id')) db.exec('ALTER TABLE agents ADD COLUMN parent_id TEXT');
  if (!columns.has('instance')) db.exec("ALTER TABLE agents ADD COLUMN instance TEXT NOT NULL DEFAULT 'builtin'");
}

/** Databases created before the post-run QA handoff lack this column. */
function migrateClaudeCodeRunsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(claude_code_runs)') as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('qa_report')) db.exec('ALTER TABLE claude_code_runs ADD COLUMN qa_report TEXT');
}

/** Databases created before the retry-cap tracking lack this column. */
function migrateDelegatedTasksTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(delegated_tasks)') as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('retry_count')) db.exec('ALTER TABLE delegated_tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0');
}

/** Databases created before the funnel-space build lack these columns. */
function migrateFunnelContactsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(funnel_contacts)') as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('relationship')) db.exec("ALTER TABLE funnel_contacts ADD COLUMN relationship TEXT NOT NULL DEFAULT 'warm'");
  if (!columns.has('likelihood')) db.exec('ALTER TABLE funnel_contacts ADD COLUMN likelihood INTEGER NOT NULL DEFAULT 50');
  if (!columns.has('email')) db.exec('ALTER TABLE funnel_contacts ADD COLUMN email TEXT');
  if (!columns.has('phone')) db.exec('ALTER TABLE funnel_contacts ADD COLUMN phone TEXT');
  // dossier identity (Round 15) — the human behind the deal
  for (const col of ['person', 'company', 'role', 'linkedin']) {
    if (!columns.has(col)) db.exec(`ALTER TABLE funnel_contacts ADD COLUMN ${col} TEXT`);
  }
}

// Skills gained a `markdown` (SKILL.md) column after first ship. Add it, and
// clear the stale rows so the re-seed backfills each skill's doc.
function migrateSkillsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set((db.pragma('table_info(skills)') as { name: string }[]).map((c) => c.name));
  if (columns.size > 0 && !columns.has('markdown')) {
    db.exec("ALTER TABLE skills ADD COLUMN markdown TEXT NOT NULL DEFAULT ''");
    db.exec('DELETE FROM skills');
  }
}

type AgentRow = {
  id: string;
  department_id: string;
  name: string;
  role: string;
  status: string;
  tier: string;
  description: string;
  model: string;
  tools: string;
  parent_id: string | null;
  instance: string;
};

function rowToAgent(row: AgentRow): Agent {
  return AgentSchema.parse({
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    role: row.role,
    status: row.status,
    tier: row.tier,
    description: row.description,
    model: row.model,
    tools: JSON.parse(row.tools),
    parentId: row.parent_id,
    instance: row.instance,
  });
}

/** lead_magnets gained `origin` when the operator started creating them from the
 *  OS; older databases predate the column. */
function migrateLeadMagnetsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(lead_magnets)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('origin')) db.exec("ALTER TABLE lead_magnets ADD COLUMN origin TEXT NOT NULL DEFAULT 'seed'");
}

/** agent_crons gained `last_run_at` when the scheduler engine landed; older
 *  databases predate the column. */
function migrateAgentCronsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(agent_crons)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('last_run_at')) db.exec('ALTER TABLE agent_crons ADD COLUMN last_run_at TEXT');
}

/** ideas gained `project_id` when the idea -> project promotion seam landed;
 *  older databases predate the column. */
function migrateIdeasTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(ideas)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('project_id')) db.exec('ALTER TABLE ideas ADD COLUMN project_id TEXT');
}

export function openDb(path: string) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(DDL);
  migrateAgentsTable(db);
  migrateClaudeCodeRunsTable(db);
  migrateDelegatedTasksTable(db);
  migrateLeadMagnetsTable(db);
  migrateFunnelContactsTable(db);
  migrateSkillsTable(db);
  migrateAgentCronsTable(db);
  migrateIdeasTable(db);

  const departments = {
    all(): Department[] {
      return db
        .prepare('SELECT * FROM departments ORDER BY "order"')
        .all()
        .map((r) => DepartmentSchema.parse(r));
    },
    insert(d: Department): void {
      db.prepare(
        'INSERT OR REPLACE INTO departments (id, name, slug, tagline, color, "order") VALUES (?, ?, ?, ?, ?, ?)',
      ).run(d.id, d.name, d.slug, d.tagline, d.color, d.order);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(`DELETE FROM departments WHERE id NOT IN (${placeholders})`).run(...ids);
    },
  };

  const agents = {
    all(): Agent[] {
      return (db.prepare('SELECT * FROM agents ORDER BY tier, name').all() as AgentRow[]).map(rowToAgent);
    },
    byDepartment(departmentId: string): Agent[] {
      return (
        db
          .prepare('SELECT * FROM agents WHERE department_id = ? ORDER BY tier, name')
          .all(departmentId) as AgentRow[]
      ).map(rowToAgent);
    },
    insert(a: Agent): void {
      db.prepare(
        'INSERT OR REPLACE INTO agents (id, department_id, name, role, status, tier, description, model, tools, parent_id, instance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        a.id, a.departmentId, a.name, a.role, a.status, a.tier, a.description, a.model,
        JSON.stringify(a.tools), a.parentId, a.instance,
      );
    },
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(`DELETE FROM agents WHERE id NOT IN (${placeholders})`).run(...ids);
    },
  };

  const tools = {
    all(): Tool[] {
      return db
        .prepare('SELECT * FROM tools ORDER BY category, name')
        .all()
        .map((r) => ToolSchema.parse(r));
    },
    insert(t: Tool): void {
      db.prepare(
        'INSERT OR REPLACE INTO tools (id, name, category, status, color, description) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(t.id, t.name, t.category, t.status, t.color, t.description);
    },
  };

  const roadmap = {
    all(): RoadmapItem[] {
      return db
        .prepare('SELECT * FROM roadmap_items ORDER BY quarter, title')
        .all()
        .map((r: any) =>
          RoadmapItemSchema.parse({
            id: r.id,
            title: r.title,
            quarter: r.quarter,
            status: r.status,
            departmentId: r.department_id,
            description: r.description,
          }),
        );
    },
    insert(item: RoadmapItem): void {
      db.prepare(
        'INSERT OR REPLACE INTO roadmap_items (id, title, quarter, status, department_id, description) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(item.id, item.title, item.quarter, item.status, item.departmentId, item.description);
    },
  };

  const metrics = {
    all(): Metric[] {
      return db
        .prepare('SELECT * FROM metrics ORDER BY label')
        .all()
        .map((r) => MetricSchema.parse(r));
    },
    insert(m: Metric): void {
      db.prepare(
        'INSERT OR REPLACE INTO metrics (id, key, label, value, unit, delta, period) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(m.id, m.key, m.label, m.value, m.unit, m.delta, m.period);
    },
  };

  const domains = {
    all(): Domain[] {
      return db
        .prepare('SELECT * FROM domains ORDER BY number')
        .all()
        .map((r: any) => DomainSchema.parse({ ...r, items: JSON.parse(r.items) }));
    },
    insert(d: Domain): void {
      db.prepare('INSERT OR REPLACE INTO domains (id, number, title, color, items) VALUES (?, ?, ?, ?, ?)').run(
        d.id,
        d.number,
        d.title,
        d.color,
        JSON.stringify(d.items),
      );
    },
  };

  const personas = {
    all(): Persona[] {
      return db
        .prepare('SELECT * FROM personas ORDER BY ord')
        .all()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) =>
          PersonaSchema.parse({
            id: r.id,
            order: r.ord,
            name: r.name,
            archetype: r.archetype,
            tagline: r.tagline,
            summary: r.summary,
            accent: r.accent,
            northStar: r.north_star,
            pillars: JSON.parse(r.pillars),
            connectors: JSON.parse(r.connectors),
            metrics: JSON.parse(r.metrics),
            brainUse: r.brain_use,
            signaturePlay: r.signature_play,
          }),
        );
    },
    insert(p: Persona): void {
      db.prepare(
        `INSERT OR REPLACE INTO personas
          (id, ord, name, archetype, tagline, summary, accent, north_star, pillars, connectors, metrics, brain_use, signature_play)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        p.id,
        p.order,
        p.name,
        p.archetype,
        p.tagline,
        p.summary,
        p.accent,
        p.northStar,
        JSON.stringify(p.pillars),
        JSON.stringify(p.connectors),
        JSON.stringify(p.metrics),
        p.brainUse,
        p.signaturePlay,
      );
    },
  };

  const phases = {
    all(): Phase[] {
      return db
        .prepare('SELECT * FROM phases ORDER BY number')
        .all()
        .map((r: any) => PhaseSchema.parse({ ...r, items: JSON.parse(r.items) }));
    },
    insert(p: Phase): void {
      db.prepare('INSERT OR REPLACE INTO phases (id, number, title, items) VALUES (?, ?, ?, ?)').run(
        p.id,
        p.number,
        p.title,
        JSON.stringify(p.items),
      );
    },
  };

  const rowToRun = (r: any): AgentRun =>
    AgentRunSchema.parse({
      id: r.id,
      agentId: r.agent_id,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      ok: Boolean(r.ok),
      summary: r.summary,
    });

  const agentRuns = {
    byAgent(agentId: string): AgentRun[] {
      return db
        .prepare('SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_at DESC')
        .all(agentId)
        .map(rowToRun);
    },
    recent(limit: number): AgentRun[] {
      return db
        .prepare('SELECT * FROM agent_runs ORDER BY started_at DESC, rowid DESC LIMIT ?')
        .all(limit)
        .map(rowToRun);
    },
    insert(run: AgentRun): void {
      db.prepare(
        'INSERT OR REPLACE INTO agent_runs (id, agent_id, started_at, finished_at, ok, summary) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(run.id, run.agentId, run.startedAt, run.finishedAt, run.ok ? 1 : 0, run.summary);
    },
  };

  const rowToErrorLog = (r: any): ErrorLog =>
    ErrorLogSchema.parse({
      id: r.id,
      source: r.source,
      context: r.context,
      message: r.message,
      stack: r.stack,
      createdAt: r.created_at,
    });

  /** Real production error sink — see ErrorLogSchema for why this is
   *  separate from agent_runs. recent() caps at 500 rows by construction
   *  (never an unbounded SELECT * for a monitoring dashboard). prune()
   *  deletes rows older than a cutoff, for a scheduled retention job so
   *  a small persistent volume never fills up with error history. */
  const errorLogs = {
    recent(limit = 100): ErrorLog[] {
      return db
        .prepare('SELECT * FROM error_logs ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(Math.min(limit, 500))
        .map(rowToErrorLog);
    },
    insert(e: ErrorLog): void {
      const parsed = ErrorLogSchema.parse(e);
      db.prepare(
        'INSERT OR REPLACE INTO error_logs (id, source, context, message, stack, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(parsed.id, parsed.source, parsed.context, parsed.message, parsed.stack, parsed.createdAt);
    },
    prune(olderThanDays: number): number {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      const result = db.prepare('DELETE FROM error_logs WHERE created_at < ?').run(cutoff);
      return result.changes;
    },
  };

  const rowToMessage = (r: any): AgentMessage =>
    AgentMessageSchema.parse({
      id: r.id,
      agentId: r.agent_id,
      role: r.role,
      content: r.content,
      toolCalls: JSON.parse(r.tool_calls || '[]'),
      createdAt: r.created_at,
    });

  const agentMessages = {
    insert(m: AgentMessage): void {
      const parsed = AgentMessageSchema.parse(m);
      db.prepare(
        'INSERT OR REPLACE INTO agent_messages (id, agent_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(parsed.id, parsed.agentId, parsed.role, parsed.content, JSON.stringify(parsed.toolCalls), parsed.createdAt);
    },
    /** Full conversation for one agent, oldest → newest (ready to replay). */
    byAgent(agentId: string): AgentMessage[] {
      return db
        .prepare('SELECT * FROM agent_messages WHERE agent_id = ? ORDER BY created_at ASC, rowid ASC')
        .all(agentId)
        .map(rowToMessage);
    },
    recent(limit: number): AgentMessage[] {
      return db
        .prepare('SELECT * FROM agent_messages ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(limit)
        .map(rowToMessage);
    },
  };

  const rowToReply = (r: any): BroadcastReply =>
    BroadcastReplySchema.parse({
      id: r.id,
      broadcastId: r.broadcast_id,
      agentId: r.agent_id,
      ok: Boolean(r.ok),
      reply: r.reply,
      finishedAt: r.finished_at,
    });

  const broadcasts = {
    insert(b: { id: string; message: string; createdAt: string }): void {
      db.prepare('INSERT OR REPLACE INTO broadcasts (id, message, created_at) VALUES (?, ?, ?)').run(
        b.id, b.message, b.createdAt,
      );
    },
    insertReply(r: BroadcastReply): void {
      db.prepare(
        'INSERT OR REPLACE INTO broadcast_replies (id, broadcast_id, agent_id, ok, reply, finished_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(r.id, r.broadcastId, r.agentId, r.ok ? 1 : 0, r.reply, r.finishedAt);
    },
    recent(limit: number): Broadcast[] {
      const rows = db
        .prepare('SELECT * FROM broadcasts ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(limit) as { id: string; message: string; created_at: string }[];
      const replyStmt = db.prepare('SELECT * FROM broadcast_replies WHERE broadcast_id = ? ORDER BY agent_id');
      return rows.map((b) =>
        BroadcastSchema.parse({
          id: b.id,
          message: b.message,
          createdAt: b.created_at,
          replies: replyStmt.all(b.id).map(rowToReply),
        }),
      );
    },
  };

  const rowToTask = (r: any): AgentTask =>
    AgentTaskSchema.parse({
      id: r.id, agentId: r.agent_id, title: r.title, status: r.status,
      createdAt: r.created_at, updatedAt: r.updated_at,
    });

  const agentTasks = {
    insert(t: AgentTask): void {
      AgentTaskSchema.parse(t);
      db.prepare(
        'INSERT OR REPLACE INTO agent_tasks (id, agent_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(t.id, t.agentId, t.title, t.status, t.createdAt, t.updatedAt);
    },
    byAgent(agentId: string): AgentTask[] {
      return db
        .prepare('SELECT * FROM agent_tasks WHERE agent_id = ? ORDER BY created_at DESC, rowid DESC')
        .all(agentId)
        .map(rowToTask);
    },
    all(): AgentTask[] {
      return db.prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC, rowid DESC').all().map(rowToTask);
    },
    setStatus(id: string, status: AgentTask['status'], updatedAt: string): void {
      AgentTaskSchema.shape.status.parse(status);
      db.prepare('UPDATE agent_tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id);
    },
    remove(id: string): void {
      db.prepare('DELETE FROM agent_tasks WHERE id = ?').run(id);
    },
  };

  const rowToCron = (r: any): AgentCron =>
    AgentCronSchema.parse({
      id: r.id, agentId: r.agent_id, schedule: r.schedule, description: r.description,
      enabled: Boolean(r.enabled), createdAt: r.created_at, lastRunAt: r.last_run_at ?? null,
    });

  const agentCrons = {
    insert(c: AgentCron): void {
      AgentCronSchema.parse(c);
      if (!isValidCron(c.schedule)) throw new Error(`invalid cron schedule: ${c.schedule}`);
      db.prepare(
        'INSERT OR REPLACE INTO agent_crons (id, agent_id, schedule, description, enabled, created_at, last_run_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(c.id, c.agentId, c.schedule, c.description, c.enabled ? 1 : 0, c.createdAt, c.lastRunAt ?? null);
    },
    byAgent(agentId: string): AgentCron[] {
      return db
        .prepare('SELECT * FROM agent_crons WHERE agent_id = ? ORDER BY created_at DESC, rowid DESC')
        .all(agentId)
        .map(rowToCron);
    },
    byId(id: string): AgentCron | null {
      const r = db.prepare('SELECT * FROM agent_crons WHERE id = ?').get(id) as any;
      return r ? rowToCron(r) : null;
    },
    all(): AgentCron[] {
      return db.prepare('SELECT * FROM agent_crons ORDER BY created_at DESC, rowid DESC').all().map(rowToCron);
    },
    /** Every enabled cron, regardless of agent — what the scheduler tick reads. */
    allEnabled(): AgentCron[] {
      return db
        .prepare('SELECT * FROM agent_crons WHERE enabled = 1 ORDER BY created_at DESC, rowid DESC')
        .all()
        .map(rowToCron);
    },
    setEnabled(id: string, enabled: boolean): void {
      db.prepare('UPDATE agent_crons SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    },
    setLastRunAt(id: string, lastRunAt: string): void {
      db.prepare('UPDATE agent_crons SET last_run_at = ? WHERE id = ?').run(lastRunAt, id);
    },
    remove(id: string): void {
      db.prepare('DELETE FROM agent_crons WHERE id = ?').run(id);
    },
  };

  const contactTags = {
    upsert(t: ContactTag): void {
      ContactTagSchema.parse(t);
      db.prepare(
        'INSERT INTO contact_tags (person, channel, tag, tier) VALUES (?, ?, ?, ?) ON CONFLICT(person, channel) DO UPDATE SET tag = excluded.tag, tier = excluded.tier',
      ).run(t.person, t.channel, t.tag, t.tier);
    },
    all(): ContactTag[] {
      return (db.prepare('SELECT * FROM contact_tags ORDER BY tier, person').all() as ContactTag[]).map(
        (r) => ContactTagSchema.parse(r),
      );
    },
    byTier(tier: number): ContactTag[] {
      return (
        db.prepare('SELECT * FROM contact_tags WHERE tier = ? ORDER BY person').all(tier) as ContactTag[]
      ).map((r) => ContactTagSchema.parse(r));
    },
    remove(person: string, channel: string): void {
      db.prepare('DELETE FROM contact_tags WHERE person = ? AND channel = ?').run(person, channel);
    },
  };

  const rowToSnapshot = (r: any): SocialSnapshot =>
    SocialSnapshotSchema.parse({
      platform: r.platform,
      capturedAt: r.captured_at,
      followers: r.followers,
      source: r.source,
    });

  const social = {
      /** Tüm sosyal seed verilerini temizle. */
      clearSeeded(): void {
        db.prepare('DELETE FROM social_snapshots').run();
        db.prepare('DELETE FROM social_accounts').run();
        db.prepare('DELETE FROM social_dm_messages').run();
        db.prepare('DELETE FROM social_dm_snapshots').run();
        db.prepare('DELETE FROM social_dms').run();
        db.prepare('DELETE FROM social_posts').run();
      },
      upsertAccount(a: SocialAccount): void {
      SocialAccountSchema.parse(a);
      db.prepare(
        'INSERT OR REPLACE INTO social_accounts (platform, handle, url, "order") VALUES (?, ?, ?, ?)',
      ).run(a.platform, a.handle, a.url, a.order);
    },
    accounts(): SocialAccount[] {
      return db
        .prepare('SELECT * FROM social_accounts ORDER BY "order"')
        .all()
        .map((r) => SocialAccountSchema.parse(r));
    },
    insertSnapshot(s: SocialSnapshot): void {
      SocialSnapshotSchema.parse(s);
      db.prepare(
        'INSERT OR REPLACE INTO social_snapshots (platform, captured_at, followers, source) VALUES (?, ?, ?, ?)',
      ).run(s.platform, s.capturedAt, s.followers, s.source);
    },
    snapshots(platform: SocialPlatform): SocialSnapshot[] {
      return db
        .prepare('SELECT * FROM social_snapshots WHERE platform = ? ORDER BY captured_at')
        .all(platform)
        .map(rowToSnapshot);
    },
    latest(): SocialSnapshot[] {
      return db
        .prepare(
          `SELECT * FROM social_snapshots s
           WHERE captured_at = (SELECT MAX(captured_at) FROM social_snapshots WHERE platform = s.platform)
           ORDER BY platform`,
        )
        .all()
        .map(rowToSnapshot);
    },
    upsertDm(d: SocialDm): void {
      SocialDmSchema.parse(d);
      db.prepare(
        'INSERT OR REPLACE INTO social_dms (platform, count, updated_at) VALUES (?, ?, ?)',
      ).run(d.platform, d.count, d.updatedAt);
    },
    dms(): SocialDm[] {
      return db
        .prepare(
          `SELECT d.platform, d.count, d.updated_at AS updatedAt FROM social_dms d
           LEFT JOIN social_accounts a ON a.platform = d.platform
           ORDER BY a."order"`,
        )
        .all()
        .map((r) => SocialDmSchema.parse(r));
    },
    insertDmSnapshot(s: SocialDmSnapshot): void {
      SocialDmSnapshotSchema.parse(s);
      db.prepare(
        'INSERT OR REPLACE INTO social_dm_snapshots (platform, captured_at, count, source) VALUES (?, ?, ?, ?)',
      ).run(s.platform, s.capturedAt, s.count, s.source);
    },
    dmSnapshots(platform?: SocialPlatform): SocialDmSnapshot[] {
      const rows = platform
        ? db
            .prepare('SELECT platform, captured_at AS capturedAt, count, source FROM social_dm_snapshots WHERE platform = ? ORDER BY captured_at')
            .all(platform)
        : db
            .prepare('SELECT platform, captured_at AS capturedAt, count, source FROM social_dm_snapshots ORDER BY platform, captured_at')
            .all();
      return rows.map((r) => SocialDmSnapshotSchema.parse(r));
    },
    // Individual DM messages (the inbox). Fed live by POST /api/webhooks/manychat;
    // seeded until then. Upsert by id so replayed webhooks don't duplicate.
    upsertDmMessage(m: SocialDmMessage): void {
      SocialDmMessageSchema.parse(m);
      db.prepare(
        `INSERT OR REPLACE INTO social_dm_messages
           (id, platform, subscriber_id, name, handle, text, direction, tag, ts, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(m.id, m.platform, m.subscriberId, m.name, m.handle, m.text, m.direction, m.tag, m.ts, m.source);
    },
    dmMessages(platform?: SocialPlatform): SocialDmMessage[] {
      const cols =
        'id, platform, subscriber_id AS subscriberId, name, handle, text, direction, tag, ts, source';
      const rows = platform
        ? db.prepare(`SELECT ${cols} FROM social_dm_messages WHERE platform = ? ORDER BY ts DESC`).all(platform)
        : db.prepare(`SELECT ${cols} FROM social_dm_messages ORDER BY ts DESC`).all();
      return rows.map((r) => SocialDmMessageSchema.parse(r));
    },
  };

  const emailList = {
    insertSnapshot(s: EmailListSnapshot): void {
      EmailListSnapshotSchema.parse(s);
      db.prepare(
        'INSERT OR REPLACE INTO email_list_snapshots (captured_at, subscribers, source) VALUES (?, ?, ?)',
      ).run(s.capturedAt, s.subscribers, s.source);
    },
    // Drop seed-sourced rows so a re-seed is authoritative — the real Beehiiv
    // baseline replaces any retired dummy history. Live-synced snapshots
    // (source 'beehiiv') are preserved.
    deleteSeeded(): void {
      db.prepare("DELETE FROM email_list_snapshots WHERE source LIKE 'seed%'").run();
    },
    snapshots(): EmailListSnapshot[] {
      return db
        .prepare('SELECT captured_at AS capturedAt, subscribers, source FROM email_list_snapshots ORDER BY captured_at')
        .all()
        .map((r) => EmailListSnapshotSchema.parse(r));
    },
    latest(): EmailListSnapshot | null {
      const row = db
        .prepare('SELECT captured_at AS capturedAt, subscribers, source FROM email_list_snapshots ORDER BY captured_at DESC LIMIT 1')
        .get();
      return row ? EmailListSnapshotSchema.parse(row) : null;
    },
  };

  const rowToPost = (r: {
    id: string;
    caption: string;
    media_url: string | null;
    platforms: string;
    status: string;
    scheduled_for: string | null;
    created_at: string;
  }): SocialPost =>
    SocialPostSchema.parse({
      id: r.id,
      caption: r.caption,
      mediaUrl: r.media_url,
      platforms: JSON.parse(r.platforms),
      status: r.status,
      scheduledFor: r.scheduled_for,
      createdAt: r.created_at,
    });

  const socialPosts = {
    enqueue(p: SocialPost): void {
      SocialPostSchema.parse(p);
      db.prepare(
        `INSERT OR REPLACE INTO social_posts (id, caption, media_url, platforms, status, scheduled_for, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(p.id, p.caption, p.mediaUrl, JSON.stringify(p.platforms), p.status, p.scheduledFor, p.createdAt);
    },
    all(): SocialPost[] {
      return db
        .prepare('SELECT * FROM social_posts ORDER BY created_at DESC')
        .all()
        .map((r) => rowToPost(r as Parameters<typeof rowToPost>[0]));
    },
    queued(): SocialPost[] {
      return db
        .prepare("SELECT * FROM social_posts WHERE status = 'queued' ORDER BY created_at DESC")
        .all()
        .map((r) => rowToPost(r as Parameters<typeof rowToPost>[0]));
    },
  };

  const people = {
    all(): Person[] {
      return db
        .prepare('SELECT * FROM people ORDER BY department_id, name')
        .all()
        .map((r: any) =>
          PersonSchema.parse({
            id: r.id,
            departmentId: r.department_id,
            name: r.name,
            role: r.role,
            tools: JSON.parse(r.tools),
          }),
        );
    },
    insert(p: Person): void {
      PersonSchema.parse(p);
      db.prepare(
        'INSERT OR REPLACE INTO people (id, department_id, name, role, tools) VALUES (?, ?, ?, ?, ?)',
      ).run(p.id, p.departmentId, p.name, p.role, JSON.stringify(p.tools));
    },
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(`DELETE FROM people WHERE id NOT IN (${placeholders})`).run(...ids);
    },
  };

  const leadMagnets = {
    all(): LeadMagnet[] {
      return db
        .prepare('SELECT * FROM lead_magnets ORDER BY launched_at DESC, name')
        .all()
        .map((r: any) =>
          LeadMagnetSchema.parse({
            id: r.id,
            name: r.name,
            offer: r.offer,
            url: r.url,
            status: r.status,
            captures: r.captures,
            destination: r.destination,
            source: r.source,
            launchedAt: r.launched_at,
            notes: r.notes,
            origin: r.origin ?? 'seed',
          }),
        );
    },
    insert(m: LeadMagnet): void {
      LeadMagnetSchema.parse(m);
      db.prepare(
        'INSERT OR REPLACE INTO lead_magnets (id, name, offer, url, status, captures, destination, source, launched_at, notes, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(m.id, m.name, m.offer, m.url, m.status, m.captures, m.destination, m.source, m.launchedAt, m.notes, m.origin ?? 'seed');
    },
    byId(id: string): LeadMagnet | null {
      const r = db.prepare('SELECT * FROM lead_magnets WHERE id = ?').get(id) as any;
      if (!r) return null;
      return LeadMagnetSchema.parse({
        id: r.id, name: r.name, offer: r.offer, url: r.url, status: r.status,
        captures: r.captures, destination: r.destination, source: r.source,
        launchedAt: r.launched_at, notes: r.notes, origin: r.origin ?? 'seed',
      });
    },
    /** Delete one row by id. Returns false when it was not there, so the API
     *  can 404 instead of pretending. */
    remove(id: string): boolean {
      return db.prepare('DELETE FROM lead_magnets WHERE id = ?').run(id).changes > 0;
    },
    /** Prune retired SEED rows only. Anything created from the OS is the operator's
     *  and is never deleted by a re-seed. */
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(
        `DELETE FROM lead_magnets WHERE origin = 'seed' AND id NOT IN (${placeholders})`,
      ).run(...ids);
    },
  };

  const projects = {
    all(): Project[] {
      return db
        .prepare('SELECT * FROM projects ORDER BY updated_at DESC, name')
        .all()
        .map((r: any) =>
          ProjectSchema.parse({
            id: r.id,
            name: r.name,
            kind: r.kind,
            pathOrUrl: r.path_or_url,
            purpose: r.purpose,
            status: r.status,
            permissionLevel: r.permission_level,
            authorizedAgentIds: JSON.parse(r.authorized_agent_ids),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            origin: r.origin ?? 'seed',
          }),
        );
    },
    insert(p: Project): void {
      const parsed = ProjectSchema.parse(p);
      db.prepare(
        'INSERT OR REPLACE INTO projects (id, name, kind, path_or_url, purpose, status, permission_level, authorized_agent_ids, created_at, updated_at, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.name,
        parsed.kind,
        parsed.pathOrUrl,
        parsed.purpose,
        parsed.status,
        parsed.permissionLevel,
        JSON.stringify(parsed.authorizedAgentIds),
        parsed.createdAt,
        parsed.updatedAt,
        parsed.origin,
      );
    },
    byId(id: string): Project | null {
      const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
      if (!r) return null;
      return ProjectSchema.parse({
        id: r.id,
        name: r.name,
        kind: r.kind,
        pathOrUrl: r.path_or_url,
        purpose: r.purpose,
        status: r.status,
        permissionLevel: r.permission_level,
        authorizedAgentIds: JSON.parse(r.authorized_agent_ids),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        origin: r.origin ?? 'seed',
      });
    },
    /** Delete one row by id. Returns false when it was not there, so the API
     *  can 404 instead of pretending. */
    remove(id: string): boolean {
      return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
    },
    /** Prune retired SEED rows only — an operator- or agent-registered project
     *  (origin: 'os') is never deleted by a re-seed. Same contract as leadMagnets. */
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(
        `DELETE FROM projects WHERE origin = 'seed' AND id NOT IN (${placeholders})`,
      ).run(...ids);
    },
  };

  const ideas = {
    all(): Idea[] {
      return db
        .prepare('SELECT * FROM ideas ORDER BY updated_at DESC, title')
        .all()
        .map((r: any) =>
          IdeaSchema.parse({
            id: r.id,
            title: r.title,
            description: r.description,
            marketSize: r.market_size,
            effort: r.effort,
            strategicFit: r.strategic_fit,
            status: r.status,
            projectId: r.project_id ?? null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }),
        );
    },
    insert(i: Idea): void {
      const parsed = IdeaSchema.parse(i);
      db.prepare(
        'INSERT OR REPLACE INTO ideas (id, title, description, market_size, effort, strategic_fit, status, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.title,
        parsed.description,
        parsed.marketSize,
        parsed.effort,
        parsed.strategicFit,
        parsed.status,
        parsed.projectId,
        parsed.createdAt,
        parsed.updatedAt,
      );
    },
    byId(id: string): Idea | null {
      const r = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id) as any;
      if (!r) return null;
      return IdeaSchema.parse({
        id: r.id,
        title: r.title,
        description: r.description,
        marketSize: r.market_size,
        effort: r.effort,
        strategicFit: r.strategic_fit,
        status: r.status,
        projectId: r.project_id ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    },
    remove(id: string): boolean {
      return db.prepare('DELETE FROM ideas WHERE id = ?').run(id).changes > 0;
    },
  };

  function rowToNotification(r: any): Notification {
    return NotificationSchema.parse({
      id: r.id,
      kind: r.kind,
      agentId: r.agent_id,
      title: r.title,
      body: r.body,
      requiresApproval: Boolean(r.requires_approval),
      status: r.status,
      channel: r.channel,
      createdAt: r.created_at,
      sentAt: r.sent_at ?? null,
      decidedAt: r.decided_at ?? null,
      decidedBy: r.decided_by ?? null,
      responseText: r.response_text ?? null,
    });
  }

  const notifications = {
    all(): Notification[] {
      return db
        .prepare('SELECT * FROM notifications ORDER BY created_at DESC')
        .all()
        .map((r: any) => rowToNotification(r));
    },
    pending(): Notification[] {
      return db
        .prepare("SELECT * FROM notifications WHERE status = 'pending' ORDER BY created_at ASC")
        .all()
        .map((r: any) => rowToNotification(r));
    },
    byId(id: string): Notification | null {
      const r = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any;
      return r ? rowToNotification(r) : null;
    },
    insert(n: Notification): void {
      const parsed = NotificationSchema.parse(n);
      db.prepare(
        'INSERT OR REPLACE INTO notifications (id, kind, agent_id, title, body, requires_approval, status, channel, created_at, sent_at, decided_at, decided_by, response_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.kind,
        parsed.agentId,
        parsed.title,
        parsed.body,
        parsed.requiresApproval ? 1 : 0,
        parsed.status,
        parsed.channel,
        parsed.createdAt,
        parsed.sentAt,
        parsed.decidedAt,
        parsed.decidedBy,
        parsed.responseText,
      );
    },
    markSent(id: string): void {
      db.prepare("UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id,
      );
    },
    markFailed(id: string): void {
      db.prepare("UPDATE notifications SET status = 'failed' WHERE id = ?").run(id);
    },
    /** Records a decision on an approval_request row. Never called for
     *  daily_report/alert kinds by any route — see the architecture doc:
     *  a decision must be traceable to who made it (decidedBy), and the raw
     *  reply text is kept for audit even though only the status is acted on. */
    decide(id: string, status: 'approved' | 'rejected', decidedBy: string, responseText: string | null): void {
      db.prepare(
        'UPDATE notifications SET status = ?, decided_at = ?, decided_by = ?, response_text = ? WHERE id = ?',
      ).run(status, new Date().toISOString(), decidedBy, responseText, id);
    },
  };

  // ── Project Lifecycle Orchestrator ─────────────────────────────────────
  function rowToLifecycleState(r: any): ProjectLifecycleState {
    return ProjectLifecycleStateSchema.parse({
      projectId: r.project_id,
      currentPhase: r.current_phase,
      history: JSON.parse(r.history),
      updatedAt: r.updated_at,
    });
  }

  const lifecycleState = {
    all(): ProjectLifecycleState[] {
      return db.prepare('SELECT * FROM project_lifecycle_state').all().map((r: any) => rowToLifecycleState(r));
    },
    byProjectId(projectId: string): ProjectLifecycleState | null {
      const r = db.prepare('SELECT * FROM project_lifecycle_state WHERE project_id = ?').get(projectId) as any;
      return r ? rowToLifecycleState(r) : null;
    },
    upsert(s: ProjectLifecycleState): void {
      const parsed = ProjectLifecycleStateSchema.parse(s);
      db.prepare(
        'INSERT OR REPLACE INTO project_lifecycle_state (project_id, current_phase, history, updated_at) VALUES (?, ?, ?, ?)',
      ).run(parsed.projectId, parsed.currentPhase, JSON.stringify(parsed.history), parsed.updatedAt);
    },
    remove(projectId: string): boolean {
      return db.prepare('DELETE FROM project_lifecycle_state WHERE project_id = ?').run(projectId).changes > 0;
    },
  };

  function rowToLifecycleTask(r: any): LifecycleTask {
    return LifecycleTaskSchema.parse({
      id: r.id,
      projectId: r.project_id,
      phase: r.phase,
      title: r.title,
      responsibleAgentId: r.responsible_agent_id,
      status: r.status,
      blockedReason: r.blocked_reason ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }

  const lifecycleTasks = {
    byProjectId(projectId: string): LifecycleTask[] {
      return (
        db.prepare('SELECT * FROM lifecycle_tasks WHERE project_id = ? ORDER BY created_at').all(projectId) as any[]
      ).map(rowToLifecycleTask);
    },
    insert(t: LifecycleTask): void {
      const parsed = LifecycleTaskSchema.parse(t);
      db.prepare(
        'INSERT OR REPLACE INTO lifecycle_tasks (id, project_id, phase, title, responsible_agent_id, status, blocked_reason, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.projectId,
        parsed.phase,
        parsed.title,
        parsed.responsibleAgentId,
        parsed.status,
        parsed.blockedReason,
        parsed.createdAt,
        parsed.updatedAt,
      );
    },
    updateStatus(id: string, status: LifecycleTask['status'], blockedReason: string | null): void {
      db.prepare('UPDATE lifecycle_tasks SET status = ?, blocked_reason = ?, updated_at = ? WHERE id = ?').run(
        status,
        blockedReason,
        new Date().toISOString(),
        id,
      );
    },
  };

  function rowToLifecycleApproval(r: any): LifecycleApproval {
    return LifecycleApprovalSchema.parse({
      id: r.id,
      projectId: r.project_id,
      phase: r.phase,
      title: r.title,
      description: r.description,
      requestedByAgentId: r.requested_by_agent_id,
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at ?? null,
      decidedBy: r.decided_by ?? null,
      notes: r.notes ?? null,
    });
  }

  const lifecycleApprovals = {
    byProjectId(projectId: string): LifecycleApproval[] {
      return (
        db
          .prepare('SELECT * FROM lifecycle_approvals WHERE project_id = ? ORDER BY created_at DESC')
          .all(projectId) as any[]
      ).map(rowToLifecycleApproval);
    },
    pending(): LifecycleApproval[] {
      return (
        db.prepare("SELECT * FROM lifecycle_approvals WHERE status = 'pending' ORDER BY created_at").all() as any[]
      ).map(rowToLifecycleApproval);
    },
    insert(a: LifecycleApproval): void {
      const parsed = LifecycleApprovalSchema.parse(a);
      db.prepare(
        'INSERT OR REPLACE INTO lifecycle_approvals (id, project_id, phase, title, description, requested_by_agent_id, status, created_at, decided_at, decided_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.projectId,
        parsed.phase,
        parsed.title,
        parsed.description,
        parsed.requestedByAgentId,
        parsed.status,
        parsed.createdAt,
        parsed.decidedAt,
        parsed.decidedBy,
        parsed.notes,
      );
    },
    decide(id: string, status: 'approved' | 'rejected', decidedBy: string, notes: string | null): void {
      db.prepare(
        'UPDATE lifecycle_approvals SET status = ?, decided_at = ?, decided_by = ?, notes = ? WHERE id = ?',
      ).run(status, new Date().toISOString(), decidedBy, notes, id);
    },
    byId(id: string): LifecycleApproval | null {
      const r = db.prepare('SELECT * FROM lifecycle_approvals WHERE id = ?').get(id) as any;
      return r ? rowToLifecycleApproval(r) : null;
    },
  };

  // ── Lifecycle Evidence (phase exit gating) ────────────────────────────────
  function rowToLifecycleEvidence(r: any): LifecycleEvidence {
    return LifecycleEvidenceSchema.parse({
      id: r.id,
      projectId: r.project_id,
      phase: r.phase,
      kind: r.kind,
      ok: Boolean(r.ok),
      summary: r.summary,
      recordedByAgentId: r.recorded_by_agent_id,
      recordedAt: r.recorded_at,
    });
  }

  const lifecycleEvidence = {
    byProjectId(projectId: string): LifecycleEvidence[] {
      return (
        db.prepare('SELECT * FROM lifecycle_evidence WHERE project_id = ? ORDER BY recorded_at DESC, rowid DESC').all(projectId) as any[]
      ).map(rowToLifecycleEvidence);
    },
    /** Every evidence row for one project's one phase — a phase may be
     *  attempted more than once (e.g. a failing build_test then a passing
     *  one after a fix), so this returns all of them, newest first. Ties on
     *  recorded_at (same-millisecond ISO timestamps — real under fast
     *  successive calls, e.g. in tests) break on rowid DESC, which SQLite
     *  guarantees tracks insert order — recorded_at DESC alone has no
     *  documented tie-break and was observed picking the WRONG row when
     *  two evidence rows for the same phase landed in the same millisecond. */
    byProjectPhase(projectId: string, phase: string): LifecycleEvidence[] {
      return (
        db
          .prepare('SELECT * FROM lifecycle_evidence WHERE project_id = ? AND phase = ? ORDER BY recorded_at DESC, rowid DESC')
          .all(projectId, phase) as any[]
      ).map(rowToLifecycleEvidence);
    },
    insert(e: LifecycleEvidence): void {
      const parsed = LifecycleEvidenceSchema.parse(e);
      db.prepare(
        'INSERT OR REPLACE INTO lifecycle_evidence (id, project_id, phase, kind, ok, summary, recorded_by_agent_id, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.projectId,
        parsed.phase,
        parsed.kind,
        parsed.ok ? 1 : 0,
        parsed.summary,
        parsed.recordedByAgentId,
        parsed.recordedAt,
      );
    },
  };

  // ── Capability / Tool Registry ──────────────────────────────────────────
  function rowToCapability(r: any): CapabilityProvider {
    return CapabilityProviderSchema.parse({
      id: r.id,
      name: r.name,
      capability: r.capability,
      type: r.type,
      connector: r.connector ?? null,
      authRequired: Boolean(r.auth_required),
      costModel: r.cost_model,
      freeTier: r.free_tier ?? null,
      status: r.status,
      installed: Boolean(r.installed),
      configured: Boolean(r.configured),
      approvedByUser: Boolean(r.approved_by_user),
      allowedAgents: JSON.parse(r.allowed_agents),
      notes: r.notes ?? null,
      lastVerifiedAt: r.last_verified_at ?? null,
    });
  }

  const capabilities = {
    all(): CapabilityProvider[] {
      return (db.prepare('SELECT * FROM capabilities ORDER BY capability, name').all() as any[]).map(rowToCapability);
    },
    byId(id: string): CapabilityProvider | null {
      const r = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(id) as any;
      return r ? rowToCapability(r) : null;
    },
    byCapability(capability: string): CapabilityProvider[] {
      return (
        db.prepare('SELECT * FROM capabilities WHERE capability = ? ORDER BY name').all(capability) as any[]
      ).map(rowToCapability);
    },
    /** Candidates that need a human decision before they can be used: a
     *  paid cost model or an auth requirement, still in 'candidate' status.
     *  Free, no-auth candidates do NOT show up here — they can move straight
     *  to 'available' without asking anyone (see the Approval Policy). */
    pendingApproval(): CapabilityProvider[] {
      return (
        db
          .prepare(
            "SELECT * FROM capabilities WHERE status = 'candidate' AND (cost_model = 'paid' OR auth_required = 1) ORDER BY name",
          )
          .all() as any[]
      ).map(rowToCapability);
    },
    insert(c: CapabilityProvider): void {
      const parsed = CapabilityProviderSchema.parse(c);
      db.prepare(
        `INSERT OR REPLACE INTO capabilities
         (id, name, capability, type, connector, auth_required, cost_model, free_tier, status, installed, configured, approved_by_user, allowed_agents, notes, last_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        parsed.id,
        parsed.name,
        parsed.capability,
        parsed.type,
        parsed.connector,
        parsed.authRequired ? 1 : 0,
        parsed.costModel,
        parsed.freeTier,
        parsed.status,
        parsed.installed ? 1 : 0,
        parsed.configured ? 1 : 0,
        parsed.approvedByUser ? 1 : 0,
        JSON.stringify(parsed.allowedAgents),
        parsed.notes,
        parsed.lastVerifiedAt,
      );
    },
    /** The ONE path that flips approvedByUser true. Only ever called from a
     *  route the operator explicitly hit — never from agent code deciding
     *  on its own. Moves status to 'active' since an approved capability is
     *  immediately usable by its allowed agents. */
    approve(id: string, allowedAgents: string[]): void {
      db.prepare(
        "UPDATE capabilities SET approved_by_user = 1, status = 'active', allowed_agents = ? WHERE id = ?",
      ).run(JSON.stringify(allowedAgents), id);
    },
    reject(id: string, notes: string | null): void {
      db.prepare("UPDATE capabilities SET status = 'rejected', notes = ? WHERE id = ?").run(notes, id);
    },
  };

  // ── Social Content Studio ───────────────────────────────────────────────
  function rowToContentPiece(r: any): ContentPiece {
    return ContentPieceSchema.parse({
      id: r.id,
      projectId: r.project_id ?? null,
      kind: r.kind,
      brief: r.brief,
      status: r.status,
      output: r.output ?? null,
      requiredCapability: r.required_capability ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }

  const contentPieces = {
    all(): ContentPiece[] {
      return (db.prepare('SELECT * FROM content_pieces ORDER BY created_at DESC').all() as any[]).map(rowToContentPiece);
    },
    byId(id: string): ContentPiece | null {
      const r = db.prepare('SELECT * FROM content_pieces WHERE id = ?').get(id) as any;
      return r ? rowToContentPiece(r) : null;
    },
    byProjectId(projectId: string): ContentPiece[] {
      return (
        db.prepare('SELECT * FROM content_pieces WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
      ).map(rowToContentPiece);
    },
    needsCapability(): ContentPiece[] {
      return (
        db.prepare("SELECT * FROM content_pieces WHERE status = 'needs_capability' ORDER BY created_at").all() as any[]
      ).map(rowToContentPiece);
    },
    insert(c: ContentPiece): void {
      const parsed = ContentPieceSchema.parse(c);
      db.prepare(
        'INSERT OR REPLACE INTO content_pieces (id, project_id, kind, brief, status, output, required_capability, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        parsed.id,
        parsed.projectId,
        parsed.kind,
        parsed.brief,
        parsed.status,
        parsed.output,
        parsed.requiredCapability,
        parsed.createdAt,
        parsed.updatedAt,
      );
    },
    updateStatus(id: string, status: ContentPiece['status'], output: string | null, requiredCapability: string | null): void {
      db.prepare(
        'UPDATE content_pieces SET status = ?, output = ?, required_capability = ?, updated_at = ? WHERE id = ?',
      ).run(status, output, requiredCapability, new Date().toISOString(), id);
    },
  };

  // ── Ad / Creative Research ───────────────────────────────────────────────
  function rowToCreativeBrief(r: any): CreativeBrief {
    return CreativeBriefSchema.parse({
      id: r.id,
      projectId: r.project_id ?? null,
      format: r.format,
      query: r.query,
      recommendation: r.recommendation,
      sources: JSON.parse(r.sources),
      createdAt: r.created_at,
    });
  }

  const creativeBriefs = {
    all(): CreativeBrief[] {
      return (db.prepare('SELECT * FROM creative_briefs ORDER BY created_at DESC').all() as any[]).map(rowToCreativeBrief);
    },
    byProjectId(projectId: string): CreativeBrief[] {
      return (
        db.prepare('SELECT * FROM creative_briefs WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
      ).map(rowToCreativeBrief);
    },
    insert(c: CreativeBrief): void {
      const parsed = CreativeBriefSchema.parse(c);
      db.prepare(
        'INSERT OR REPLACE INTO creative_briefs (id, project_id, format, query, recommendation, sources, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(parsed.id, parsed.projectId, parsed.format, parsed.query, parsed.recommendation, JSON.stringify(parsed.sources), parsed.createdAt);
    },
  };

  // ── Delegated Task (Conductor v2 work-item domain) ───────────────────────
  function rowToDelegatedTask(r: any): DelegatedTask {
    return DelegatedTaskSchema.parse({
      id: r.id,
      source: r.source,
      projectId: r.project_id,
      assignedAgentId: r.assigned_agent_id,
      goal: r.goal,
      status: r.status,
      priority: r.priority,
      dependencies: JSON.parse(r.dependencies),
      approvalRequirement: r.approval_requirement,
      createdAt: r.created_at,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      resultSummary: r.result_summary,
      failureReason: r.failure_reason,
      retryCount: r.retry_count,
    });
  }

  const TERMINAL_TASK_STATUSES = new Set(['done', 'failed', 'cancelled']);

  const delegatedTasks = {
    all(): DelegatedTask[] {
      return (db.prepare('SELECT * FROM delegated_tasks ORDER BY created_at DESC').all() as any[]).map(rowToDelegatedTask);
    },
    byId(id: string): DelegatedTask | null {
      const r = db.prepare('SELECT * FROM delegated_tasks WHERE id = ?').get(id) as any;
      return r ? rowToDelegatedTask(r) : null;
    },
    byProjectId(projectId: string): DelegatedTask[] {
      return (
        db.prepare('SELECT * FROM delegated_tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
      ).map(rowToDelegatedTask);
    },
    byAgentId(agentId: string): DelegatedTask[] {
      return (
        db.prepare('SELECT * FROM delegated_tasks WHERE assigned_agent_id = ? ORDER BY created_at DESC').all(agentId) as any[]
      ).map(rowToDelegatedTask);
    },
    /** Every task not yet in a terminal state (done/failed/cancelled) — the
     *  Conductor's live worklist, across every project and the personal domain. */
    pending(): DelegatedTask[] {
      return (db.prepare('SELECT * FROM delegated_tasks ORDER BY created_at DESC').all() as any[])
        .map(rowToDelegatedTask)
        .filter((t) => !TERMINAL_TASK_STATUSES.has(t.status));
    },
    insert(t: DelegatedTask): void {
      const parsed = DelegatedTaskSchema.parse(t);
      db.prepare(
        `INSERT OR REPLACE INTO delegated_tasks
         (id, source, project_id, assigned_agent_id, goal, status, priority, dependencies, approval_requirement, created_at, started_at, finished_at, result_summary, failure_reason, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        parsed.id,
        parsed.source,
        parsed.projectId,
        parsed.assignedAgentId,
        parsed.goal,
        parsed.status,
        parsed.priority,
        JSON.stringify(parsed.dependencies),
        parsed.approvalRequirement,
        parsed.createdAt,
        parsed.startedAt,
        parsed.finishedAt,
        parsed.resultSummary,
        parsed.failureReason,
        parsed.retryCount,
      );
    },
    /** Partial update of the mutable lifecycle fields — never touches
     *  id/source/projectId/assignedAgentId/goal/dependencies/createdAt. */
    updateStatus(
      id: string,
      patch: Partial<Pick<DelegatedTask, 'status' | 'startedAt' | 'finishedAt' | 'resultSummary' | 'failureReason' | 'approvalRequirement'>>,
    ): void {
      const current = delegatedTasks.byId(id);
      if (!current) return;
      const next = DelegatedTaskSchema.parse({ ...current, ...patch });
      db.prepare(
        `UPDATE delegated_tasks SET status = ?, started_at = ?, finished_at = ?, result_summary = ?, failure_reason = ?, approval_requirement = ? WHERE id = ?`,
      ).run(next.status, next.startedAt, next.finishedAt, next.resultSummary, next.failureReason, next.approvalRequirement, id);
    },
  };

  // ── Claude Code Orchestrator run queue ────────────────────────────────────
  function rowToClaudeCodeRun(r: any): ClaudeCodeRun {
    return ClaudeCodeRunSchema.parse({
      id: r.id,
      projectId: r.project_id,
      projectDir: r.project_dir,
      prompt: r.prompt,
      permissionLevel: r.permission_level,
      status: r.status,
      createdAt: r.created_at,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      resultSummary: r.result_summary,
      error: r.error,
      totalCostUsd: r.total_cost_usd,
      qaReport: r.qa_report,
    });
  }

  const claudeCodeRuns = {
    all(): ClaudeCodeRun[] {
      return (db.prepare('SELECT * FROM claude_code_runs ORDER BY created_at DESC').all() as any[]).map(rowToClaudeCodeRun);
    },
    byId(id: string): ClaudeCodeRun | null {
      const r = db.prepare('SELECT * FROM claude_code_runs WHERE id = ?').get(id) as any;
      return r ? rowToClaudeCodeRun(r) : null;
    },
    byProjectId(projectId: string): ClaudeCodeRun[] {
      return (
        db.prepare('SELECT * FROM claude_code_runs WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
      ).map(rowToClaudeCodeRun);
    },
    insert(r: ClaudeCodeRun): void {
      const parsed = ClaudeCodeRunSchema.parse(r);
      db.prepare(
        `INSERT OR REPLACE INTO claude_code_runs
         (id, project_id, project_dir, prompt, permission_level, status, created_at, started_at, finished_at, result_summary, error, total_cost_usd, qa_report)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        parsed.id,
        parsed.projectId,
        parsed.projectDir,
        parsed.prompt,
        parsed.permissionLevel,
        parsed.status,
        parsed.createdAt,
        parsed.startedAt,
        parsed.finishedAt,
        parsed.resultSummary,
        parsed.error,
        parsed.totalCostUsd,
        parsed.qaReport,
      );
    },
    update(
      id: string,
      patch: Partial<Pick<ClaudeCodeRun, 'status' | 'startedAt' | 'finishedAt' | 'resultSummary' | 'error' | 'totalCostUsd' | 'qaReport'>>,
    ): void {
      const current = claudeCodeRuns.byId(id);
      if (!current) return;
      const next = ClaudeCodeRunSchema.parse({ ...current, ...patch });
      db.prepare(
        'UPDATE claude_code_runs SET status = ?, started_at = ?, finished_at = ?, result_summary = ?, error = ?, total_cost_usd = ?, qa_report = ? WHERE id = ?',
      ).run(next.status, next.startedAt, next.finishedAt, next.resultSummary, next.error, next.totalCostUsd, next.qaReport, id);
    },
  };

  // ── Growth & Marketing ───────────────────────────────────────────────────
  function rowToGrowthBrief(r: any): GrowthBrief {
    return GrowthBriefSchema.parse({
      id: r.id,
      projectId: r.project_id,
      focus: r.focus,
      query: r.query,
      findings: r.findings,
      sources: JSON.parse(r.sources),
      createdAt: r.created_at,
    });
  }

  const growthBriefs = {
    all(): GrowthBrief[] {
      return (db.prepare('SELECT * FROM growth_briefs ORDER BY created_at DESC').all() as any[]).map(rowToGrowthBrief);
    },
    byProjectId(projectId: string): GrowthBrief[] {
      return (
        db.prepare('SELECT * FROM growth_briefs WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[]
      ).map(rowToGrowthBrief);
    },
    byFocus(projectId: string, focus: string): GrowthBrief[] {
      return (
        db
          .prepare('SELECT * FROM growth_briefs WHERE project_id = ? AND focus = ? ORDER BY created_at DESC')
          .all(projectId, focus) as any[]
      ).map(rowToGrowthBrief);
    },
    insert(g: GrowthBrief): void {
      const parsed = GrowthBriefSchema.parse(g);
      db.prepare(
        'INSERT OR REPLACE INTO growth_briefs (id, project_id, focus, query, findings, sources, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(parsed.id, parsed.projectId, parsed.focus, parsed.query, parsed.findings, JSON.stringify(parsed.sources), parsed.createdAt);
    },
  };

  // ── Social Publishing ────────────────────────────────────────────────────
  function rowToPublishPlan(r: any): PublishPlan {
    return PublishPlanSchema.parse({
      id: r.id,
      projectId: r.project_id ?? null,
      contentPieceId: r.content_piece_id,
      platforms: JSON.parse(r.platforms),
      adaptations: JSON.parse(r.adaptations),
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at ?? null,
      decidedBy: r.decided_by ?? null,
      publishedAt: r.published_at ?? null,
      failureReason: r.failure_reason ?? null,
    });
  }

  const publishPlans = {
    all(): PublishPlan[] {
      return (db.prepare('SELECT * FROM publish_plans ORDER BY created_at DESC').all() as any[]).map(rowToPublishPlan);
    },
    byId(id: string): PublishPlan | null {
      const r = db.prepare('SELECT * FROM publish_plans WHERE id = ?').get(id) as any;
      return r ? rowToPublishPlan(r) : null;
    },
    pending(): PublishPlan[] {
      return (
        db.prepare("SELECT * FROM publish_plans WHERE status = 'pending_approval' ORDER BY created_at").all() as any[]
      ).map(rowToPublishPlan);
    },
    insert(p: PublishPlan): void {
      const parsed = PublishPlanSchema.parse(p);
      db.prepare(
        `INSERT OR REPLACE INTO publish_plans
         (id, project_id, content_piece_id, platforms, adaptations, status, created_at, decided_at, decided_by, published_at, failure_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        parsed.id,
        parsed.projectId,
        parsed.contentPieceId,
        JSON.stringify(parsed.platforms),
        JSON.stringify(parsed.adaptations),
        parsed.status,
        parsed.createdAt,
        parsed.decidedAt,
        parsed.decidedBy,
        parsed.publishedAt,
        parsed.failureReason,
      );
    },
    /** The ONE path that can approve/reject — only ever called from a route
     *  the operator hit; a real publish never happens without this first. */
    decide(id: string, status: 'approved' | 'rejected', decidedBy: string): void {
      db.prepare('UPDATE publish_plans SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?').run(
        status,
        new Date().toISOString(),
        decidedBy,
        id,
      );
    },
    markPublished(id: string): void {
      db.prepare("UPDATE publish_plans SET status = 'published', published_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id,
      );
    },
    markFailed(id: string, reason: string): void {
      db.prepare("UPDATE publish_plans SET status = 'failed', failure_reason = ? WHERE id = ?").run(reason, id);
    },
  };

  function rowToOutboundMessage(r: any): OutboundMessage {
    return OutboundMessageSchema.parse({
      id: r.id,
      channel: r.channel,
      to: r.recipient,
      subject: r.subject ?? null,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
      decidedAt: r.decided_at ?? null,
      decidedBy: r.decided_by ?? null,
      sentAt: r.sent_at ?? null,
      failureReason: r.failure_reason ?? null,
    });
  }

  const outboundMessages = {
    all(): OutboundMessage[] {
      return (db.prepare('SELECT * FROM outbound_messages ORDER BY created_at DESC').all() as any[]).map(rowToOutboundMessage);
    },
    byId(id: string): OutboundMessage | null {
      const r = db.prepare('SELECT * FROM outbound_messages WHERE id = ?').get(id) as any;
      return r ? rowToOutboundMessage(r) : null;
    },
    pending(): OutboundMessage[] {
      return (
        db.prepare("SELECT * FROM outbound_messages WHERE status = 'pending_approval' ORDER BY created_at").all() as any[]
      ).map(rowToOutboundMessage);
    },
    insert(m: OutboundMessage): void {
      const parsed = OutboundMessageSchema.parse(m);
      db.prepare(
        `INSERT OR REPLACE INTO outbound_messages
         (id, channel, recipient, subject, body, status, created_at, decided_at, decided_by, sent_at, failure_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        parsed.id,
        parsed.channel,
        parsed.to,
        parsed.subject,
        parsed.body,
        parsed.status,
        parsed.createdAt,
        parsed.decidedAt,
        parsed.decidedBy,
        parsed.sentAt,
        parsed.failureReason,
      );
    },
    /** The ONE path that can approve/reject — a real send never happens
     *  without this first, same contract as publishPlans.decide(). */
    decide(id: string, status: 'approved' | 'rejected', decidedBy: string): void {
      db.prepare('UPDATE outbound_messages SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?').run(
        status,
        new Date().toISOString(),
        decidedBy,
        id,
      );
    },
    markSent(id: string): void {
      db.prepare("UPDATE outbound_messages SET status = 'sent', sent_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    },
    markFailed(id: string, reason: string): void {
      db.prepare("UPDATE outbound_messages SET status = 'failed', failure_reason = ? WHERE id = ?").run(reason, id);
    },
  };

  function rowToPersonalTask(r: any): PersonalTask {
    return PersonalTaskSchema.parse({
      id: r.id,
      title: r.title,
      dueAt: r.due_at ?? null,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at ?? null,
    });
  }

  const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

  const personalTasks = {
    all(): PersonalTask[] {
      return (db.prepare('SELECT * FROM personal_tasks ORDER BY created_at DESC').all() as any[]).map(rowToPersonalTask);
    },
    byId(id: string): PersonalTask | null {
      const r = db.prepare('SELECT * FROM personal_tasks WHERE id = ?').get(id) as any;
      return r ? rowToPersonalTask(r) : null;
    },
    /** Open tasks, highest priority first, then earliest due date (nulls last). */
    open(): PersonalTask[] {
      const rows = (db.prepare("SELECT * FROM personal_tasks WHERE status = 'open'").all() as any[]).map(rowToPersonalTask);
      return rows.sort((a, b) => {
        const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pr !== 0) return pr;
        if (a.dueAt === b.dueAt) return 0;
        if (a.dueAt === null) return 1;
        if (b.dueAt === null) return -1;
        return a.dueAt.localeCompare(b.dueAt);
      });
    },
    insert(t: PersonalTask): void {
      const parsed = PersonalTaskSchema.parse(t);
      db.prepare(
        `INSERT OR REPLACE INTO personal_tasks (id, title, due_at, priority, status, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(parsed.id, parsed.title, parsed.dueAt, parsed.priority, parsed.status, parsed.createdAt, parsed.completedAt);
    },
    complete(id: string): void {
      db.prepare("UPDATE personal_tasks SET status = 'done', completed_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    },
    remove(id: string): void {
      db.prepare('DELETE FROM personal_tasks WHERE id = ?').run(id);
    },
  };

  function rowToRoutine(r: any): Routine {
    return RoutineSchema.parse({
      id: r.id,
      title: r.title,
      frequency: r.frequency,
      active: Boolean(r.active),
      createdAt: r.created_at,
    });
  }

  const routines = {
    all(): Routine[] {
      return (db.prepare('SELECT * FROM routines ORDER BY created_at DESC').all() as any[]).map(rowToRoutine);
    },
    byId(id: string): Routine | null {
      const r = db.prepare('SELECT * FROM routines WHERE id = ?').get(id) as any;
      return r ? rowToRoutine(r) : null;
    },
    active(): Routine[] {
      return (db.prepare('SELECT * FROM routines WHERE active = 1 ORDER BY created_at').all() as any[]).map(rowToRoutine);
    },
    insert(r: Routine): void {
      const parsed = RoutineSchema.parse(r);
      db.prepare('INSERT OR REPLACE INTO routines (id, title, frequency, active, created_at) VALUES (?, ?, ?, ?, ?)').run(
        parsed.id,
        parsed.title,
        parsed.frequency,
        parsed.active ? 1 : 0,
        parsed.createdAt,
      );
    },
    setActive(id: string, active: boolean): void {
      db.prepare('UPDATE routines SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
    },
    remove(id: string): void {
      db.prepare('DELETE FROM routines WHERE id = ?').run(id);
      db.prepare('DELETE FROM routine_completions WHERE routine_id = ?').run(id);
    },
  };

  function rowToRoutineCompletion(r: any): RoutineCompletion {
    return RoutineCompletionSchema.parse({
      id: r.id,
      routineId: r.routine_id,
      completedOn: r.completed_on,
      completedAt: r.completed_at,
    });
  }

  const routineCompletions = {
    forRoutine(routineId: string): RoutineCompletion[] {
      return (
        db.prepare('SELECT * FROM routine_completions WHERE routine_id = ? ORDER BY completed_on DESC').all(routineId) as any[]
      ).map(rowToRoutineCompletion);
    },
    /** Append-only, but idempotent per calendar day — the UNIQUE(routine_id,
     *  completed_on) constraint means checking in twice on the same day
     *  never creates a duplicate streak entry. */
    insert(c: RoutineCompletion): void {
      const parsed = RoutineCompletionSchema.parse(c);
      db.prepare(
        'INSERT OR IGNORE INTO routine_completions (id, routine_id, completed_on, completed_at) VALUES (?, ?, ?, ?)',
      ).run(parsed.id, parsed.routineId, parsed.completedOn, parsed.completedAt);
    },
  };

  const sopTasks = {
    all(): SopTask[] {
      return db
        .prepare('SELECT * FROM sop_tasks ORDER BY department_id, title')
        .all()
        .map((r: any) =>
          SopTaskSchema.parse({
            id: r.id,
            departmentId: r.department_id,
            title: r.title,
            summary: r.summary,
            steps: JSON.parse(r.steps),
            assigneeKind: r.assignee_kind,
            assigneeId: r.assignee_id,
          }),
        );
    },
    insert(t: SopTask): void {
      SopTaskSchema.parse(t);
      db.prepare(
        'INSERT OR REPLACE INTO sop_tasks (id, department_id, title, summary, steps, assignee_kind, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(t.id, t.departmentId, t.title, t.summary, JSON.stringify(t.steps), t.assigneeKind, t.assigneeId);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(`DELETE FROM sop_tasks WHERE id NOT IN (${placeholders})`).run(...ids);
    },
  };

  const workflows = {
    all(): Workflow[] {
      return db
        .prepare('SELECT * FROM workflows ORDER BY ord, name')
        .all()
        .map((r: any) =>
          WorkflowSchema.parse({
            id: r.id,
            name: r.name,
            subtitle: r.subtitle,
            revenueUsd: r.revenue_usd,
            order: r.ord,
            steps: JSON.parse(r.steps),
          }),
        );
    },
    insert(w: Workflow): void {
      WorkflowSchema.parse(w);
      db.prepare(
        'INSERT OR REPLACE INTO workflows (id, name, subtitle, revenue_usd, ord, steps) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(w.id, w.name, w.subtitle, w.revenueUsd, w.order, JSON.stringify(w.steps));
    },
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(`DELETE FROM workflows WHERE id NOT IN (${placeholders})`).run(...ids);
    },
  };

  const skills = {
    all(): Skill[] {
      return db
        .prepare('SELECT * FROM skills ORDER BY ord, name')
        .all()
        .map((r: any) =>
          SkillSchema.parse({
            id: r.id,
            name: r.name,
            category: r.category,
            description: r.description,
            ownerAgentId: r.owner_agent_id,
            status: r.status,
            tools: JSON.parse(r.tools),
            markdown: r.markdown,
            order: r.ord,
          }),
        );
    },
    insert(s: Skill): void {
      SkillSchema.parse(s);
      db.prepare(
        'INSERT OR REPLACE INTO skills (id, name, category, description, owner_agent_id, status, tools, markdown, ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(s.id, s.name, s.category, s.description, s.ownerAgentId, s.status, JSON.stringify(s.tools), s.markdown, s.order);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(`DELETE FROM skills WHERE id NOT IN (${placeholders})`).run(...ids);
    },
  };

  const rowToFunnelTouch = (r: any): FunnelTouch =>
    FunnelTouchSchema.parse({
      id: r.id,
      contactId: r.contact_id,
      seq: r.seq,
      stage: r.stage,
      channel: r.channel,
      label: r.label,
      source: r.source,
      at: r.at,
    });

  const funnel = {
      /** Seed verilerini temizle (fc-* pattern). */
      clearSeeded(): void {
        db.prepare("DELETE FROM funnel_touches WHERE contact_id IN (SELECT id FROM funnel_contacts WHERE id LIKE 'fc-%')").run();
        db.prepare("DELETE FROM funnel_contacts WHERE id LIKE 'fc-%'").run();
      },
      insertContact(c: FunnelContact): void {
      FunnelContactSchema.parse(c);
      db.prepare(
        'INSERT OR REPLACE INTO funnel_contacts (id, name, venture, status, product, amount_usd, relationship, likelihood, email, phone, person, company, role, linkedin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(c.id, c.name, c.venture, c.status, c.product, c.amountUsd, c.relationship, c.likelihood, c.email, c.phone, c.person, c.company, c.role, c.linkedin, c.createdAt);
    },
    insertTouch(t: FunnelTouch): void {
      FunnelTouchSchema.parse(t);
      db.prepare(
        'INSERT OR REPLACE INTO funnel_touches (id, contact_id, seq, stage, channel, label, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(t.id, t.contactId, t.seq, t.stage, t.channel, t.label, t.source, t.at);
    },
    /** Contacts with their touches in journey order, newest contact first. */
    journeys(venture?: FunnelVenture): FunnelJourney[] {
      const rows = (
        venture
          ? db.prepare('SELECT * FROM funnel_contacts WHERE venture = ? ORDER BY created_at DESC, id').all(venture)
          : db.prepare('SELECT * FROM funnel_contacts ORDER BY created_at DESC, id').all()
      ) as any[];
      const touchStmt = db.prepare('SELECT * FROM funnel_touches WHERE contact_id = ? ORDER BY seq');
      return rows.map((r) =>
        FunnelJourneySchema.parse({
          id: r.id,
          name: r.name,
          venture: r.venture,
          status: r.status,
          product: r.product,
          amountUsd: r.amount_usd,
          relationship: r.relationship,
          likelihood: r.likelihood,
          email: r.email,
          phone: r.phone,
          person: r.person,
          company: r.company,
          role: r.role,
          linkedin: r.linkedin,
          createdAt: r.created_at,
          touches: touchStmt.all(r.id).map(rowToFunnelTouch),
        }),
      );
    },
  };

  return {
    departments,
    agents,
    tools,
    roadmap,
    metrics,
    domains,
    personas,
    phases,
    agentRuns,
    errorLogs,
    agentMessages,
    agentTasks,
    agentCrons,
    broadcasts,
    contactTags,
    social,
    emailList,
    socialPosts,
    funnel,
    people,
    leadMagnets,
    projects,
    ideas,
    notifications,
    lifecycleState,
    lifecycleTasks,
    lifecycleApprovals,
    lifecycleEvidence,
    capabilities,
    contentPieces,
    creativeBriefs,
    delegatedTasks,
    claudeCodeRuns,
    growthBriefs,
    publishPlans,
    outboundMessages,
    personalTasks,
    routines,
    routineCompletions,
    sopTasks,
    workflows,
    skills,
    close: () => db.close(),
  };
}

export type FounderDb = ReturnType<typeof openDb>;
