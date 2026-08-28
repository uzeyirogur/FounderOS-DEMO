import type { openDb } from '@/lib/db';

type Db = ReturnType<typeof openDb>;

export interface ConductorStatus {
  pendingLifecycleApprovals: number;
  pendingPublishPlans: number;
  pendingOutboundMessages: number;
  candidateCapabilities: number;
  blockedContentPieces: number;
  totalBlockers: number;
}

/**
 * Chief of Staff v2's real cross-system status aggregation. Reads every
 * domain this build actually has — never hardcoded to a single project —
 * so "what is blocked / waiting on me" is always a live count, not a
 * guess. New domains added later should be added here too.
 */
export function aggregateStatus(db: Db): ConductorStatus {
  const pendingLifecycleApprovals = db.lifecycleApprovals.pending().length;
  const pendingPublishPlans = db.publishPlans.pending().length;
  const pendingOutboundMessages = db.outboundMessages.pending().length;
  const candidateCapabilities = db.capabilities.all().filter((c) => c.status === 'candidate').length;
  const blockedContentPieces = db.contentPieces.needsCapability().length;

  return {
    pendingLifecycleApprovals,
    pendingPublishPlans,
    pendingOutboundMessages,
    candidateCapabilities,
    blockedContentPieces,
    totalBlockers:
      pendingLifecycleApprovals + pendingPublishPlans + pendingOutboundMessages + candidateCapabilities + blockedContentPieces,
  };
}
