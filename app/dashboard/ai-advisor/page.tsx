'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Bot, Send, User, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface OrgContext {
  employees: number
  resources: number
  permissions: number
  anomalies: number
  orgName: string
}

const SUGGESTED_QUESTIONS = [
  '¿Qué riesgos de seguridad tiene mi organización ahora mismo?',
  '¿Qué permisos debería revocar urgentemente?',
  '¿Cómo mejorar el cumplimiento ISO 27001?',
  '¿Qué es Shadow IT y cómo afecta a mi empresa?',
]

export default function AIAdvisorPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<OrgContext | null>(null)
  const [orgId, setOrgId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations(name)')
        .eq('id', user.id)
        .single()
      if (!profile) return

      setOrgId(profile.organization_id)
      const oid = profile.organization_id

      const [emp, res, perm, anom] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact' }).eq('organization_id', oid),
        supabase.from('resources').select('id', { count: 'exact' }).eq('organization_id', oid),
        supabase.from('permissions').select('id', { count: 'exact' }).eq('organization_id', oid),
        supabase.from('permissions').select('id', { count: 'exact' }).eq('organization_id', oid).eq('is_anomalous', true),
      ])

      setContext({
        orgName: (profile.organizations as any)?.name || '',
        employees: emp.count || 0,
        resources: res.count || 0,
        permissions: perm.count || 0,
        anomalies: anom.count || 0,
      })
    }
    load()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildSystemPrompt = () => {
    if (!context) return ''
    return `Eres un experto en ciberseguridad y gestión de identidades y accesos (IAM/IAG) para la plataforma AccessGuard.

Estado actual de la organización "${context.orgName}":
- Empleados: ${context.employees}
- Recursos (apps, carpetas, sistemas): ${context.resources}
- Permisos activos: ${context.permissions}
- Anomalías detectadas: ${context.anomalies}

Tu rol es analizar esta información y dar recomendaciones concretas, accionables y en español. 
Sé directo, usa bullets cuando sea útil, y enfócate en seguridad práctica. 
Si hay anomalías, prioriza abordarlas. Menciona estándares como ISO 27001 o SOC2 cuando sea relevante.`
  }

  const sendMessage = async (text?: string) => {
    const userMessage = text || input.trim()
    if (!userMessage || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: buildSystemPrompt()
        })
      })

      const data = await response.json()
      setMessages([...newMessages, { role: 'assistant', content: data.content }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error al conectar con el AI Advisor. Inténtalo de nuevo.' }])
    }

    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto text-white h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-400" /> AI Advisor
        </h1>
        <p className="text-slate-400 text-sm mt-1">Consulta a la IA sobre la seguridad de tu organización</p>
      </div>

      {context && (
        <Card className="bg-blue-500/5 border-blue-500/20 mb-4">
          <CardContent className="p-3 flex items-center gap-6 text-sm">
            <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="text-slate-300">
              Analizando <span className="text-white font-medium">{context.orgName}</span> —
              {context.employees} empleados · {context.permissions} permisos ·
              <span className={context.anomalies > 0 ? 'text-red-400 font-medium' : 'text-green-400'}>
                {' '}{context.anomalies} anomalías
              </span>
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800 flex-1 flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[450px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
              <Bot className="h-12 w-12 text-slate-600" />
              <p className="text-slate-500 text-sm">Pregúntame sobre la seguridad de tu organización</p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="text-left text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="p-1.5 rounded-md bg-blue-500/10 h-fit">
                    <Bot className="h-4 w-4 text-blue-400" />
                  </div>
                )}
                <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      li: ({children}) => <li>{children}</li>,
                      strong: ({children}) => <strong className="text-white font-semibold">{children}</strong>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  ) : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="p-1.5 rounded-md bg-slate-700 h-fit">
                    <User className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3">
              <div className="p-1.5 rounded-md bg-blue-500/10 h-fit">
                <Bot className="h-4 w-4 text-blue-400" />
              </div>
              <div className="bg-slate-800 px-4 py-3 rounded-xl rounded-tl-none">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 border-t border-slate-800 flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Pregunta sobre seguridad, permisos, compliance..."
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}