'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    organizationName: '',
    sector: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    setError('')

    if (!formData.fullName || !formData.email || !formData.password || !formData.organizationName) {
      setError('Por favor rellena todos los campos obligatorios.')
      setLoading(false)
      return
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    })

    if (authError || !authData.user) {
      setError('Error al crear la cuenta. ' + authError?.message)
      setLoading(false)
      return
    }

    // 2. Crear organización
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: formData.organizationName, sector: formData.sector })
      .select()
      .single()

    if (orgError || !org) {
      setError('Error al crear la organización.')
      setLoading(false)
      return
    }

    // 3. Crear perfil de admin
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        organization_id: org.id,
        full_name: formData.fullName,
        role: 'admin'
      })

    if (profileError) {
      setError('Error al crear el perfil.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-10">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-500" />
          </div>
          <CardTitle className="text-2xl text-white">Registra tu empresa</CardTitle>
          <CardDescription className="text-slate-400">
            Empieza a auditar accesos con AccessGuard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-slate-300">Nombre completo *</Label>
            <Input
              placeholder="Alex Crespo"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Email *</Label>
            <Input
              type="email"
              placeholder="admin@empresa.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Contraseña *</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Nombre de la empresa *</Label>
            <Input
              placeholder="Acme Corp"
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Sector (opcional)</Label>
            <Input
              placeholder="Tecnología, Finanzas, Salud..."
              value={formData.sector}
              onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
          <p className="text-slate-100 text-sm text-center">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-blue-400 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}