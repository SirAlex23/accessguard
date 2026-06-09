'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Shield, RefreshCw } from 'lucide-react'

interface Permission {
  id: string
  access_level: string
  is_anomalous: boolean
  employees: { full_name: string; department: string; role_title: string }
  resources: { name: string; sensitivity: string }
}

interface AnomalyResult {
  permission: Permission
  reason: string
  severity: 'high' | 'critical'
}

export default function ShadowITPage() {
  const supabase = createClient()
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([])
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.organization_id)
        await runScan(profile.organization_id)
      }
    }
    load()
  }, [])

  const runScan = async (oid: string) => {
    setScanning(true)
    const { data: permissions } = await supabase
      .from('permissions')
      .select('*, employees(full_name, department, role_title), resources(name, sensitivity)')
      .eq('organization_id', oid)

    if (!permissions) { setScanning(false); setLoading(false); return }

    const detected: AnomalyResult[] = []

    for (const p of permissions) {
      const reasons: string[] = []
      let severity: 'high' | 'critical' = 'high'

      // Regla 1: acceso admin a recurso crítico para roles no-IT
      if (p.access_level === 'admin' && p.resources?.sensitivity === 'critical') {
        const role = p.employees?.role_title?.toLowerCase() || ''
        const isIT = role.includes('it') || role.includes('admin') || role.includes('developer') || role.includes('director it')
        if (!isIT) {
          reasons.push(`Acceso admin a recurso crítico "${p.resources.name}" para rol "${p.employees?.role_title}"`)
          severity = 'critical'
        }
      }

      // Regla 2: RRSS o Marketing con acceso a sistemas críticos
      const dept = p.employees?.department?.toLowerCase() || ''
      if ((dept.includes('rrss') || dept.includes('marketing') || dept.includes('rrhh')) &&
        p.resources?.sensitivity === 'critical' && p.access_level !== 'read') {
        reasons.push(`Departamento "${p.employees?.department}" con acceso "${p.access_level}" a recurso crítico`)
        severity = 'critical'
      }

      // Regla 3: acceso write o admin a recurso de alta sensibilidad sin ser IT
      if ((p.access_level === 'write' || p.access_level === 'admin') && p.resources?.sensitivity === 'high') {
        const role = p.employees?.role_title?.toLowerCase() || ''
        const isIT = role.includes('it') || role.includes('admin') || role.includes('developer')
        if (!isIT) {
          reasons.push(`Acceso de escritura a recurso de alta sensibilidad sin perfil técnico`)
        }
      }

      if (reasons.length > 0) {
        detected.push({ permission: p, reason: reasons[0], severity })
        // Marcar como anómalo en BD
        await supabase.from('permissions').update({ is_anomalous: true }).eq('id', p.id)
      } else {
        await supabase.from('permissions').update({ is_anomalous: false }).eq('id', p.id)
      }
    }

    setAnomalies(detected)
    setLastScan(new Date().toLocaleTimeString())
    setScanning(false)
    setLoading(false)
  }

  const severityStyle = {
    critical: 'border-red-500/30 bg-red-500/5',
    high: 'border-orange-500/30 bg-orange-500/5',
  }

  const severityBadge = {
    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" /> Shadow IT Detector
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Detecta accesos anómalos y permisos que no deberían existir
          </p>
        </div>
        <Button onClick={() => runScan(orgId)} disabled={scanning} className="bg-blue-600 hover:bg-blue-700">
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Escaneando...' : 'Re-escanear'}
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-red-400">{anomalies.filter(a => a.severity === 'critical').length}</p>
              <p className="text-slate-400 text-xs">Anomalías críticas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-orange-400">{anomalies.filter(a => a.severity === 'high').length}</p>
              <p className="text-slate-400 text-xs">Anomalías altas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-green-400">{anomalies.length === 0 ? '✓' : anomalies.length}</p>
              <p className="text-slate-400 text-xs">{anomalies.length === 0 ? 'Sin anomalías' : 'Total detectadas'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {lastScan && <p className="text-slate-500 text-xs mb-4">Último escaneo: {lastScan}</p>}

      {/* Lista de anomalías */}
      {loading ? (
        <p className="text-slate-500 text-center py-8">Escaneando permisos...</p>
      ) : anomalies.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <Shield className="h-12 w-12 text-green-400" />
            <p className="text-green-400 font-medium">Sin anomalías detectadas</p>
            <p className="text-slate-500 text-sm">Todos los permisos parecen correctos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {anomalies.map((a, i) => (
            <Card key={i} className={`border ${severityStyle[a.severity]}`}>
              <CardContent className="p-4 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${a.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`} />
                  <div>
                    <p className="text-white font-medium">{a.permission.employees?.full_name}</p>
                    <p className="text-slate-400 text-sm">{a.permission.employees?.department} · {a.permission.employees?.role_title}</p>
                    <p className="text-slate-300 text-sm mt-2">→ {a.reason}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${severityBadge[a.severity]}`}>
                  {a.severity}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}