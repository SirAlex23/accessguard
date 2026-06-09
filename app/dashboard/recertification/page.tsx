'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  deadline: string
  created_at: string
}

interface Decision {
  id: string
  decision: string
  permissions: {
    access_level: string
    employees: { full_name: string; department: string }
    resources: { name: string }
  }
}

export default function RecertificationPage() {
  const supabase = createClient()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', deadline: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.organization_id)
        fetchCampaigns(profile.organization_id)
      }
    }
    load()
  }, [])

  const fetchCampaigns = async (oid: string) => {
    const { data } = await supabase.from('recertification_campaigns')
      .select('*').eq('organization_id', oid).order('created_at', { ascending: false })
    setCampaigns(data || [])
    setLoading(false)
  }

  const handleCreateCampaign = async () => {
    if (!form.name || !form.deadline) return

    const { data: campaign } = await supabase.from('recertification_campaigns')
      .insert({ name: form.name, deadline: form.deadline, organization_id: orgId, status: 'active' })
      .select().single()

    if (!campaign) return

    // Crear decisiones pendientes para todos los permisos
    const { data: perms } = await supabase.from('permissions')
      .select('id').eq('organization_id', orgId)

    if (perms && perms.length > 0) {
      await supabase.from('recertification_decisions').insert(
        perms.map(p => ({
          campaign_id: campaign.id,
          permission_id: p.id,
          decision: 'pending'
        }))
      )
    }

    setForm({ name: '', deadline: '' })
    setShowForm(false)
    fetchCampaigns(orgId)
  }

  const loadDecisions = async (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    const { data } = await supabase.from('recertification_decisions')
      .select('*, permissions(access_level, employees(full_name, department), resources(name))')
      .eq('campaign_id', campaign.id)
    setDecisions(data || [])
  }

  const handleDecision = async (decisionId: string, decision: 'approved' | 'revoked') => {
    await supabase.from('recertification_decisions').update({
      decision, decided_by: userId, decided_at: new Date().toISOString()
    }).eq('id', decisionId)
    if (selectedCampaign) loadDecisions(selectedCampaign)
  }

  const statusColors: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    expired: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }

  const decisionStyle: Record<string, string> = {
    pending: 'text-yellow-400',
    approved: 'text-green-400',
    revoked: 'text-red-400',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-blue-400" /> Recertificación
          </h1>
          <p className="text-slate-400 text-sm mt-1">Campañas de revisión de accesos</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Nueva campaña
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardHeader><CardTitle className="text-white text-base">Nueva campaña</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <input placeholder="Nombre de la campaña *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-slate-500" />
            <input type="date" value={form.deadline}
              onChange={e => setForm({ ...form, deadline: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm" />
            <div className="col-span-2 flex gap-3">
              <Button onClick={handleCreateCampaign} className="bg-blue-600 hover:bg-blue-700">Crear campaña</Button>
              <Button onClick={() => setShowForm(false)} variant="ghost" className="text-slate-400">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista campañas */}
        <div className="space-y-3">
          <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Campañas</h2>
          {loading ? <p className="text-slate-500 text-sm">Cargando...</p>
            : campaigns.length === 0 ? <p className="text-slate-500 text-sm">Sin campañas aún.</p>
            : campaigns.map(c => (
              <Card key={c.id}
                onClick={() => loadDecisions(c)}
                className={`cursor-pointer transition-colors border ${selectedCampaign?.id === c.id ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
                <CardContent className="p-4">
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <p className="text-slate-500 text-xs mt-1">Deadline: {new Date(c.deadline).toLocaleDateString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border mt-2 inline-block ${statusColors[c.status]}`}>
                    {c.status}
                  </span>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Decisiones */}
        <div className="lg:col-span-2">
          {!selectedCampaign ? (
            <Card className="bg-slate-900 border-slate-800 border-dashed">
              <CardContent className="flex items-center justify-center h-40 text-slate-600">
                Selecciona una campaña para revisar accesos
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wide">
                Accesos a revisar — {selectedCampaign.name}
              </h2>
              {decisions.map(d => (
                <Card key={d.id} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{d.permissions?.employees?.full_name}</p>
                      <p className="text-slate-400 text-sm">
                        {d.permissions?.resources?.name} · <span className="text-slate-500">{d.permissions?.access_level}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.decision === 'pending' ? (
                        <>
                          <Button size="sm" onClick={() => handleDecision(d.id, 'approved')}
                            className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" /> Aprobar
                          </Button>
                          <Button size="sm" onClick={() => handleDecision(d.id, 'revoked')}
                            className="bg-red-600 hover:bg-red-700 h-8 text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> Revocar
                          </Button>
                        </>
                      ) : (
                        <span className={`text-sm font-medium flex items-center gap-1 ${decisionStyle[d.decision]}`}>
                          {d.decision === 'approved' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          {d.decision === 'approved' ? 'Aprobado' : 'Revocado'}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}