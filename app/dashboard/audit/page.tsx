'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Shield, Key, Users, RefreshCw } from 'lucide-react'

interface AuditLog {
  id: string
  action: string
  entity_type: string
  metadata: any
  created_at: string
  profiles: { full_name: string } | null
}

const entityIcons: Record<string, any> = {
  permission: Key,
  employee: Users,
  resource: Shield,
  campaign: RefreshCw,
}

const actionColors: Record<string, string> = {
  created: 'text-green-400',
  deleted: 'text-red-400',
  approved: 'text-blue-400',
  revoked: 'text-orange-400',
  updated: 'text-yellow-400',
  scanned: 'text-purple-400',
}

export default function AuditPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.organization_id)
        fetchLogs(profile.organization_id)
      }
    }
    load()
  }, [])

  const fetchLogs = async (oid: string) => {
    const { data } = await supabase.from('audit_logs')
      .select('*, profiles(full_name)')
      .eq('organization_id', oid)
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs(data || [])
    setLoading(false)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-slate-400" /> Audit Log
        </h1>
        <p className="text-slate-400 text-sm mt-1">Historial completo de actividad de la organización</p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-center py-8">Cargando...</p>
      ) : logs.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="h-12 w-12 text-slate-600" />
            <p className="text-slate-500">Aún no hay actividad registrada</p>
            <p className="text-slate-600 text-sm">Las acciones realizadas en el sistema aparecerán aquí</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {logs.map(log => {
                const Icon = entityIcons[log.entity_type] || FileText
                return (
                  <div key={log.id} className="px-4 py-3 flex items-start gap-4 hover:bg-slate-800/30 transition-colors">
                    <div className="mt-0.5 p-1.5 rounded-md bg-slate-800">
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${actionColors[log.action] || 'text-white'}`}>
                          {log.action}
                        </span>
                        <span className="text-slate-500 text-sm">{log.entity_type}</span>
                        {log.metadata?.name && (
                          <span className="text-slate-300 text-sm">— {log.metadata.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-slate-500 text-xs">
                          {log.profiles?.full_name || 'Sistema'}
                        </span>
                        <span className="text-slate-700 text-xs">·</span>
                        <span className="text-slate-600 text-xs">{formatDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}