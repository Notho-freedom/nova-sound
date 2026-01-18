/**
 * Workflow Usage Examples
 * 
 * Copy-paste examples for common workflow patterns
 */

import { workflows } from "@/lib/workflow";

/**
 * Example 1: Start user onboarding after signup
 */
export async function onUserSignup(
  userId: string,
  email: string,
  name: string
) {
  const workflowId = await workflows.startOnboarding({
    userId,
    email,
    name,
    signupSource: "web",
  });

  console.log(`Onboarding started for ${email}: ${workflowId}`);
  return workflowId;
}

/**
 * Example 2: Recover missing YouTube tracks
 */
export async function recoverYouTubeTracks(
  userId: string,
  trackIds: string[]
) {
  const workflowId = await workflows.startYouTubeRecovery({
    trackIds,
    userId,
    priority: "high",
  });

  console.log(
    `YouTube recovery started for ${trackIds.length} tracks: ${workflowId}`
  );
  return workflowId;
}

/**
 * Example 3: Check workflow progress
 */
export async function checkRecoveryProgress(workflowId: string) {
  const status = await workflows.getStatus("youtube-recovery", workflowId);

  console.log("Recovery progress:", status);

  // @ts-expect-error - Dynamic status shape
  if (status.state?.status === "completed") {
    // @ts-expect-error - Dynamic status shape
    console.log(`✅ Recovered ${status.state.recoveredTracks} tracks`);
  } else {
    // @ts-expect-error - Dynamic status shape
    console.log(`⏳ Progress: ${status.progress}%`);
  }

  return status;
}

/**
 * Example 4: Cancel workflow
 */
export async function cancelRecovery(workflowId: string) {
  await workflows.cancel("youtube-recovery", workflowId);
  console.log(`❌ Recovery cancelled: ${workflowId}`);
}

/**
 * Example 5: Batch YouTube recovery with progress tracking
 */
export async function batchYouTubeRecovery(
  userId: string,
  allTrackIds: string[],
  batchSize: number = 10
) {
  const workflowIds: string[] = [];

  // Split into batches
  for (let i = 0; i < allTrackIds.length; i += batchSize) {
    const batch = allTrackIds.slice(i, i + batchSize);

    const workflowId = await workflows.startYouTubeRecovery({
      trackIds: batch,
      userId,
      priority: "normal",
    });

    workflowIds.push(workflowId);
    console.log(
      `Batch ${i / batchSize + 1} started: ${batch.length} tracks (${workflowId})`
    );
  }

  return workflowIds;
}

/**
 * Example 6: Monitor multiple workflows
 */
export async function monitorWorkflows(workflowIds: string[]) {
  const statuses = await Promise.all(
    workflowIds.map((id) => workflows.getStatus("youtube-recovery", id))
  );

  const completed = statuses.filter(
    // @ts-expect-error - Dynamic status shape
    (s) => s.state?.status === "completed"
  ).length;
  const processing = statuses.filter(
    // @ts-expect-error - Dynamic status shape
    (s) => s.state?.status === "processing"
  ).length;
  const failed = statuses.filter(
    // @ts-expect-error - Dynamic status shape
    (s) => s.state?.status === "failed"
  ).length;

  console.log(`
    📊 Workflow Status:
    ✅ Completed: ${completed}
    ⏳ Processing: ${processing}
    ❌ Failed: ${failed}
  `);

  return { completed, processing, failed };
}

/**
 * Example 7: Retry failed workflows
 */
export async function retryFailedWorkflows(workflowIds: string[]) {
  const statuses = await Promise.all(
    workflowIds.map((id) => workflows.getStatus("youtube-recovery", id))
  );

  const failedWorkflows = statuses.filter(
    // @ts-expect-error - Dynamic status shape
    (s) => s.state?.status === "failed"
  );

  console.log(`Found ${failedWorkflows.length} failed workflows`);

  for (const status of failedWorkflows) {
    // @ts-expect-error - Dynamic status shape
    const { trackIds, userId } = status.state;

    // Restart workflow
    const newWorkflowId = await workflows.startYouTubeRecovery({
      trackIds,
      userId,
      priority: "high",
    });

    console.log(`Retrying workflow: ${newWorkflowId}`);
  }
}

/**
 * Example 8: Scheduled onboarding for free trial users
 */
export async function scheduleTrialReminders(
  userId: string,
  email: string,
  name: string
) {
  // Start onboarding workflow (includes trial reminders)
  await workflows.startOnboarding({
    userId,
    email,
    name,
    signupSource: "free-trial",
  });

  console.log(`Trial reminders scheduled for ${email}`);
}

/**
 * Example 9: Complex workflow orchestration
 */
export async function orchestrateLibraryImport(
  userId: string,
  files: Array<{ name: string; size: number; youtubeId?: string }>
) {
  // Separate YouTube tracks from local files
  const youtubeTracks = files
    .filter((f) => f.youtubeId)
    .map((f) => f.youtubeId!);

  // Start YouTube recovery workflow for YouTube tracks
  let youtubeWorkflowId: string | null = null;
  if (youtubeTracks.length > 0) {
    youtubeWorkflowId = await workflows.startYouTubeRecovery({
      trackIds: youtubeTracks,
      userId,
      priority: "normal",
    });
  }

  // TODO: Start file import workflow for local files
  // const fileWorkflowId = await workflows.startFileImport({ ... });

  console.log(`
    Library import orchestration:
    📹 YouTube tracks: ${youtubeTracks.length} (${youtubeWorkflowId})
    📁 Local files: ${files.length - youtubeTracks.length}
  `);

  return {
    youtubeWorkflowId,
    totalFiles: files.length,
  };
}

/**
 * Example 10: Real-time workflow progress updates
 */
export async function* streamWorkflowProgress(workflowId: string) {
  while (true) {
    const status = await workflows.getStatus("youtube-recovery", workflowId);

    yield status;

    // @ts-expect-error - Dynamic status shape
    if (status.state?.status === "completed" || status.state?.status === "failed") {
      break;
    }

    // Wait 2 seconds before next check
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
