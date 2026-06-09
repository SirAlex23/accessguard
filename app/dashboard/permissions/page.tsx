'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Key, Plus, Trash2 } from 'lucide-react'
import { logAction } from '@/lib/audit'

interface Permission {
  id: string
  access_level: string
  is_anomalous: boolean
  granted_at: string
  employees: { full_name: string; department: string }
  resources: { name: string; sensitivity: string }
}

interface Employee { id: string; full_name: string }
interface Resource { id: string; name: string }

const accessColors: Record<string, string> = {
  read: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  write: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const sensitivityColors: Record<string, string> = {
  low: 'text-green-400', medium: 'text-yellow-400',
  high: 'text-orange-400', critical: 'text-red-400',
}

export default function PermissionsPage() {
  const supabase = createClient()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ employee_id: '', resource_id: '', access_level: 'read' })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.organization_id)
        await Promise.all([
          fetchPermissions(profile.organization_id),
          fetchEmployees(profile.organization_id),
          fetchResources(profile.organization_id),
        ])
      }
    }
    load()
  }, [])

  const fetchPermissions = async (oid: string) => {
    const { data } = await supabase.from('permissions')
      .select('*, employees(full_name, department), resources(name, sensitivity)')
      .eq('organization_id', oid)
      .order('granted_at', { ascending: false })
    setPermissions(data || [])
    setLoading(false)
  }

  const fetchEmployees = async (oid: string) => {
    const { data } = await supabase.from('employees').select('id, full_name').eq('organization_id', oid)
    setEmployees(data || [])
  }

  const fetchResources = async (oid: string) => {
    const { data } = await supabase.from('resources').select('id, name').eq('organization_id', oid)
    setResources(data || [])
  }

  const handleAdd = async () => {
    if (!form.employee_id || !form.resource_id) return
    await supabase.from('permissions').insert({ ...form, organization_id: orgId })
    const emp = employees.find(e => e.id === form.employee_id)
    const res = resources.find(r => r.id === form.resource_id)
    await logAction({
      organizationId: orgId, actorId: userId, action: 'created', entityType: 'permission',
      metadata: { employee: emp?.full_name, resource: res?.name, access_level: form.access_level }
    })
    setForm({ employee_id: '', resource_id: '', access_level: 'read' })
    setShowForm(false)
    fetchPermissions(orgId)
  }

  const handleDelete = async (id: string) => {
    const perm = permissions.find(p => p.id === id)
    await supabase.from('permissions').delete().eq('id', id)
    await logAction({
      organizationId: orgId, actorId: userId, action: 'deleted', entityType: 'permission',
      metadata: { employee: perm?.employees?.full_name, resource: perm?.resources?.name }
    })
    fetchPermissions(orgId)
  }

  const selectClass = "bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm w-full"

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-purple-500" /> Permisos
          </h1>
          <p className="text-slate-400 text-sm mt-1">{permissions.length} permisos activos</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Asignar permiso
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardContent className="grid grid-cols-3 gap-4 pt-6">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Empleado *</label>
              <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className={selectClass}>
                <option value="">Selecciona empleado</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Recurso *</label>
              <select value={form.resource_id} onChange={e => setForm({ ...form, resource_id: e.target.value })} className={selectClass}>
                <option value="">Selecciona recurso</option>
                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Nivel de acceso</label>
              <select value={form.access_level} onChange={e => setForm({ ...form, access_level: e.target.value })} className={selectClass}>
                <option value="read">Lectura</option>
                <option value="write">Escritura</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-span-3 flex gap-3">
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
              <Button onClick={() => setShowForm(false)} variant="ghost" className="text-slate-400">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-4 py-3">Empleado</th>
                <th className="text-left px-4 py-3">Recurso</th>
                <th className="text-left px-4 py-3">Sensibilidad</th>
                <th className="text-left px-4 py-3">Acceso</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
              ) : permissions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Aún no hay permisos asignados.</td></tr>
              ) : permissions.map(p => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{p.employees?.full_name}</p>
                    <p className="text-slate-500 text-xs">{p.employees?.department}</p>
                  </td>
                  <td className="px-4 py-3 text-white">{p.resources?.name}</td>
                  <td className={`px-4 py-3 font-medium ${sensitivityColors[p.resources?.sensitivity]}`}>
                    {p.resources?.sensitivity}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${accessColors[p.access_level]}`}>
                      {p.access_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.is_anomalous
                      ? <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">⚠ Anomalía</span>
                      : <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">✓ Normal</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(p.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}