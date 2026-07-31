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

export default crons;
