import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Reconciliation fallback for missed/delayed webhook deliveries. Cheap by
// design - the actual diff-and-upsert logic in notices.refresh only
// overwrites the cache, it never fabricates state, so a missed run just
// means one extra interval of staleness, not a stuck record.
const crons = cronJobs();

crons.interval(
  "refresh dpdpbot notices",
  { minutes: 15 },
  internal.notices.refresh,
);

// DSR/grievance updates aren't pushed via webhook today (see webhooks.ts) -
// this is the only sync path for them until dpdpbot ships principal-scoped
// lifecycle webhooks. O(linked principals) per run; fine at small scale,
// worth revisiting before this component is used with a large user base.
crons.interval(
  "reconcile linked principals' DSR/grievance state",
  { minutes: 30 },
  internal.reconcile.principals,
);

export default crons;
