'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Plus, Trash2, Search } from 'lucide-react'
import { logAction } from '@/lib/audit'

interface Employee {
  id: string
  full_name: string
  email: string
  department: string
  role_title: string
  risk_score: number
}

export default function EmployeesPage() {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', department: '', role_title: '' })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('organization_id').eq('id', user.id).single()
      if (profile) {
        setOrgId(profile.organization_id)
        fetchEmployees(profile.organization_id)
      }
    }
    load()
  }, [])

  const fetchEmployees = async (oid: string) => {
    const { data } = await supabase.from('employees').select('*').eq('organization_id', oid).order('full_name')
    setEmployees(data || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.full_name || !form.email) return
    const { error } = await supabase.from('employees').insert({
      ...form, organization_id: orgId, risk_score: 0
    })
    if (!error) {
      await logAction({ organizationId: orgId, actorId: userId, action: 'created', entityType: 'employee', metadata: { name: form.full_name } })
      setForm({ full_name: '', email: '', department: '', role_title: '' })
      setShowForm(false)
      fetchEmployees(orgId)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    await supabase.from('employees').delete().eq('id', id)
    await logAction({ organizationId: orgId, actorId: userId, action: 'deleted', entityType: 'employee', metadata: { name } })
    fetchEmployees(orgId)
  }

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-green-400'
  }

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" /> Empleados
          </h1>
          <p className="text-slate-400 text-sm mt-1">{employees.length} empleados registrados</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Añadir empleado
        </Button>
      </div>

      {showForm && (
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardHeader><CardTitle className="text-white text-base">Nuevo empleado</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Input placeholder="Nombre completo *" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            <Input placeholder="Email *" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            <Input placeholder="Departamento" value={form.department}
              onChange={e => setForm({ ...form, department: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            <Input placeholder="Cargo" value={form.role_title}
              onChange={e => setForm({ ...form, role_title: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            <div className="col-span-2 flex gap-3">
              <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
              <Button onClick={() => setShowForm(false)} variant="ghost" className="text-slate-400">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input placeholder="Buscar empleado..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" />
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Departamento</th>
                <th className="text-left px-4 py-3">Cargo</th>
                <th className="text-left px-4 py-3">Riesgo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">
                  {employees.length === 0 ? 'Aún no hay empleados. Añade el primero.' : 'Sin resultados.'}
                </td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{emp.full_name}</td>
                  <td className="px-4 py-3 text-slate-400">{emp.email}</td>
                  <td className="px-4 py-3 text-slate-400">{emp.department || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{emp.role_title || '—'}</td>
                  <td className={`px-4 py-3 font-bold ${getRiskColor(emp.risk_score)}`}>{emp.risk_score}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(emp.id, emp.full_name)}
                      className="text-slate-600 hover:text-red-400 transition-colors">
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