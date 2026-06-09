'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, Plus, Trash2, Search } from 'lucide-react'
import { logAction } from '@/lib/audit'

interface Resource {
  id: string
  name: string
  type: 'app' | 'folder' | 'system'
  sensitivity: 'low' | 'medium' | 'high' | 'critical'
}

const typeLabels: Record<string, string> = { app: 'Aplicación', folder: 'Carpeta', system: 'Sistema' }
const sensitivityColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
}
const sensitivityLabels: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico' }

export default function ResourcesPage() {
  const supabase = createClient()
  const [resources, setResources] = useState<Resource[]>([])
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'app', sensitivity: 'low' })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.organization_id)
        fetchResources(profile.organization_id)
      }
    }
    load()
  }, [])

  const fetchResources = async (oid: string) => {
    const { data } = await supabase.from('resources').select('*').eq('organization_id', oid).order('name')
    setResources(data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.name) return
    await supabase.from('resources').insert({ ...form, organization_id: orgId })
    await logAction({ organizationId: orgId, actorId: userId, action: 'created', entityType: 'resource', metadata: { name: form.name } })
    setForm({ name: '', type: 'app', sensitivity: 'low' })
    setShowForm(false)
    fetchResources(orgId)
  }

  const handleDelete = async (id: string, name: string) => {
    await supabase.from('resources').delete().eq('id', id)
    await logAction({ organizationId: orgId, actorId: userId, action: 'deleted', entityType: 'resource', metadata: { name } })
    fetchResources(orgId)
  }

  const filtered = resources.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-green-500" /> Recursos
          </h1>
          <p className="text-slate-400 text-sm mt-1">{resources.length} recursos registrados</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Añadir recurso
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardHeader><CardTitle className="text-white text-base">Nuevo recurso</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Input placeholder="Nombre del recurso *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm">
              <option value="app">Aplicación</option>
              <option value="folder">Carpeta</option>
              <option value="system">Sistema</option>
            </select>
            <select value={form.sensitivity} onChange={e => setForm({ ...form, sensitivity: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm">
              <option value="low">Sensibilidad: Baja</option>
              <option value="medium">Sensibilidad: Media</option>
              <option value="high">Sensibilidad: Alta</option>
              <option value="critical">Sensibilidad: Crítica</option>
            </select>
            <div className="col-span-3 flex gap-3">
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
              <Button onClick={() => setShowForm(false)} variant="ghost" className="text-slate-400">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input placeholder="Buscar recurso..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" />
      </div>

      {loading ? (
        <p className="text-slate-500 text-center py-8">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 text-center py-8">
          {resources.length === 0 ? 'Aún no hay recursos. Añade el primero.' : 'Sin resultados.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(resource => (
            <Card key={resource.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{resource.name}</p>
                    <p className="text-slate-500 text-xs mt-1">{typeLabels[resource.type]}</p>
                  </div>
                  <button onClick={() => handleDelete(resource.id, resource.name)}
                    className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <span className={`text-xs px-2 py-1 rounded-full border ${sensitivityColors[resource.sensitivity]}`}>
                    {sensitivityLabels[resource.sensitivity]}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}