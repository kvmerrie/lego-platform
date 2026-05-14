import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';

type AdminOperationLogSupabaseClient = Pick<SupabaseClient, 'from'>;

export interface AdminOperationLogInput {
  actorEmail?: string | null;
  actorId?: string | null;
  durationMs: number;
  metadata?: Record<string, unknown>;
  operationType: string;
  paths?: readonly string[];
  reason: string;
  responseStatus?: number | null;
  success: boolean;
  tags?: readonly string[];
}

export async function logAdminOperation({
  input,
  supabaseClient = getServerSupabaseAdminClient(),
}: {
  input: AdminOperationLogInput;
  supabaseClient?: AdminOperationLogSupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient.from('admin_operation_logs').insert({
    actor_email: input.actorEmail ?? null,
    actor_id: input.actorId ?? null,
    duration_ms: input.durationMs,
    metadata: input.metadata ?? null,
    operation_type: input.operationType,
    paths: [...(input.paths ?? [])],
    reason: input.reason,
    response_status: input.responseStatus ?? null,
    success: input.success,
    tags: [...(input.tags ?? [])],
  });

  if (error) {
    throw new Error(
      `Unable to write admin operation log. ${error.message ?? 'Unknown Supabase error.'}`,
    );
  }
}
