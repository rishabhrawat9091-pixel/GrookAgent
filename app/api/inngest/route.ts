import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  processTaskBackgroundJob,
  dailySyncScheduledJob,
  marketingInboxMonitorJob,
  onDemandInboxPollJob,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processTaskBackgroundJob,
    dailySyncScheduledJob,
    marketingInboxMonitorJob,
    onDemandInboxPollJob,
  ],
});
