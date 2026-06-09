'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Users, Key, AlertTriangle, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Stats {
  employees: number
  resources: number
  permissions: number
  anomalies: number
}

interface ChartData {
  name: string
  permisos: number
  sensitivity: string
}

interface RecentLog {
  id: string
  action: string
  entity_type: string
  created_at: string
  metadata: any
  profiles: { full_name: string } | null
}

const sensitivityColor: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
}

const actionColors: Record<string, string> = {
  created: 'text-green-400',
  deleted: 'text-red-400',
  approved: 'text-blue-400',
  revoked: 'text-orange-400',
  updated: 'text-yellow-400',
}

export default function DashboardPage() {
  const supabase = createClient()
  const [orgName, setOrgName] = useState('')
  const [userName, setUserName] = useState('')
  const [stats, setStats] = useState<Stats>({ employees: 0, resources: 0, permissions: 0, anomalies: 0 })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, organization_id, organizations(name)')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserName(profile.full_name || '')
        setOrgName((profile.organizations as any)?.name || '')
        const orgId = profile.organization_id

        const [emp, res, perm, anom, resources, logs] = await Promise.all([
          supabase.from('employees').select('id', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('resources').select('id', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('permissions').select('id', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('permissions').select('id', { count: 'exact' }).eq('organization_id', orgId).eq('is_anomalous', true),
          supabase.from('resources').select('id, name, sensitivity').eq('organization_id', orgId),
          supabase.from('audit_logs')
            .select('*, profiles(full_name)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

        setStats({
          employees: emp.count || 0,
          resources: res.count || 0,
          permissions: perm.count || 0,
          anomalies: anom.count || 0,
        })

        // Construir datos del gráfico
        if (resources.data) {
          const permsByResource = await Promise.all(
            resources.data.map(async (r) => {
              const { count } = await supabase
                .from('permissions')
                .select('id', { count: 'exact' })
                .eq('resource_id', r.id)
              return {
                name: r.name.length > 12 ? r.name.slice(0, 12) + '…' : r.name,
                permisos: count || 0,
                sensitivity: r.sensitivity,
              }
            })
          )
          setChartData(permsByResource)
        }

        setRecentLogs(logs.data || [])
      }

      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400">Cargando...</div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Panel de Control</h1>
        <p className="text-slate-400 mt-1">Visión general de accesos y seguridad de {orgName}</p>
        <p className="text-slate-500 text-sm mt-1">Hola, {userName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">Empleados</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.employees}</div>
            <p className="text-slate-500 text-xs mt-1">usuarios registrados</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">Recursos</CardTitle>
            <Key className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.resources}</div>
            <p className="text-slate-500 text-xs mt-1">apps y sistemas</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">Permisos</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.permissions}</div>
            <p className="text-slate-500 text-xs mt-1">accesos activos</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium">Anomalías</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.anomalies}</div>
            <p className="text-slate-500 text-xs mt-1">accesos sospechosos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Gráfico permisos por recurso */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              Permisos por recurso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
                Sin datos aún
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9' }}
                    itemStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="permisos" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={sensitivityColor[entry.sensitivity] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-3 mt-3 flex-wrap">
              {Object.entries(sensitivityColor).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-slate-500 text-xs">{key}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
                Sin actividad registrada aún
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium ${actionColors[log.action] || 'text-white'}`}>
                          {log.action}
                        </span>
                        <span className="text-slate-500 text-xs">{log.entity_type}</span>
                        {log.metadata?.name && (
                          <span className="text-slate-300 text-xs truncate">— {log.metadata.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-slate-600 text-xs">{log.profiles?.full_name}</span>
                        <span className="text-slate-700 text-xs">·</span>
                        <span className="text-slate-700 text-xs">
                          {new Date(log.created_at).toLocaleString('es-ES', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}