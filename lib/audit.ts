import { createClient } from '@/lib/supabase/client'

export async function logAction({
  organizationId,
  actorId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  organizationId: string
  actorId: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, any>
}) {
  const supabase = createClient()
  await supabase.from('audit_logs').insert({
    organization_id: organizationId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  })
}