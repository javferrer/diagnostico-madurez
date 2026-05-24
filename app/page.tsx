'use client'

import { useState } from 'react'
import { preguntas } from '@/data/preguntas'
import { posthog } from '@/lib/posthog'
import { supabase } from '@/lib/supabase'

type Pantalla = 'inicio' | 'cuestionario' | 'contacto' | 'confirmacion'
type Respuestas = Record<number, number>

function calcularScores(respuestas: Respuestas) {
  const scoresPorCategoria: Record<number, number> = {}
  const preguntasPorCategoria: Record<number, number> = {}

  preguntas.forEach((p) => {
    if (!scoresPorCategoria[p.categoria]) {
      scoresPorCategoria[p.categoria] = 0
      preguntasPorCategoria[p.categoria] = 0
    }
    scoresPorCategoria[p.categoria] += respuestas[p.id] ?? 0
    preguntasPorCategoria[p.categoria]++
  })

  const scoresNormalizados: Record<number, number> = {}
  Object.keys(scoresPorCategoria).forEach((cat) => {
    const c = Number(cat)
    const max = preguntasPorCategoria[c] * 4
    scoresNormalizados[c] = Math.round((scoresPorCategoria[c] / max) * 100)
  })

  const scoreTotal = Math.round(
    Object.values(scoresNormalizados).reduce((a, b) => a + b, 0) /
      Object.values(scoresNormalizados).length
  )

  const nivel =
    scoreTotal >= 75 ? 4 :
    scoreTotal >= 50 ? 3 :
    scoreTotal >= 25 ? 2 : 1

  return { scoresNormalizados, scoreTotal, nivel }
}

export default function Home() {
  const [pantalla, setPantalla] = useState<Pantalla>('inicio')
  const [respuestas, setRespuestas] = useState<Respuestas>({})
  const [preguntaActual, setPreguntaActual] = useState(0)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const pregunta = preguntas[preguntaActual]
  const totalPreguntas = preguntas.length
  const progreso = Math.round((preguntaActual / totalPreguntas) * 100)

  const handleInicio = () => {
    setPantalla('cuestionario')
    posthog.capture('diagnostico_iniciado', {
      fuente_trafico: document.referrer || 'directo',
      dispositivo: window.innerWidth < 768 ? 'mobile' : 'desktop',
    })
  }

  const handleRespuesta = (valor: number) => {
    const nuevasRespuestas = { ...respuestas, [pregunta.id]: valor }
    setRespuestas(nuevasRespuestas)

    posthog.capture('pregunta_respondida', {
      numero_pregunta: pregunta.id,
      categoria: pregunta.categoria,
      categoria_nombre: pregunta.categoria_nombre,
    })

    if (preguntaActual < totalPreguntas - 1) {
      setPreguntaActual(preguntaActual + 1)
    } else {
      posthog.capture('formulario_contacto_visto')
      setPantalla('contacto')
    }
  }

  const handleAnterior = () => {
    if (preguntaActual > 0) setPreguntaActual(preguntaActual - 1)
  }

  const handleSubmit = async () => {
    if (!nombre || !email || !empresa || !consentimiento) return
    setEnviando(true)

    const { scoresNormalizados, scoreTotal, nivel } = calcularScores(respuestas)

    try {
      const { data: contactoData, error: errorContacto } = await supabase
        .from('contactos')
        .insert({ nombre, email, empresa, consentimiento })
        .select('id')
        .single()

      if (errorContacto) throw errorContacto

      const { error: errorDiagnostico } = await supabase
        .from('diagnosticos')
        .insert({
          contacto_id: contactoData.id,
          score_total: scoreTotal,
          score_cat1: scoresNormalizados[1],
          score_cat2: scoresNormalizados[2],
          score_cat3: scoresNormalizados[3],
          score_cat4: scoresNormalizados[4],
          score_cat5: scoresNormalizados[5],
          nivel_madurez: nivel,
        })

      if (errorDiagnostico) throw errorDiagnostico

      const resEmail = await fetch('/api/enviar-informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, empresa, scoreTotal, nivel }),
      })

      if (!resEmail.ok) {
        console.error('Error enviando email:', await resEmail.json())
      }

      posthog.capture('contacto_enviado', { empresa })
      posthog.capture('informe_enviado', { nivel_madurez: nivel, score_total: scoreTotal })
      posthog.capture('diagnostico_completado', { score_total: scoreTotal, nivel_madurez: nivel })
      setPantalla('confirmacion')

    } catch (error: any) {
    console.error('Error al guardar:', JSON.stringify(error, null, 2))
    console.error('Mensaje:', error?.message)
    console.error('Código:', error?.code)
    console.error('Hint:', error?.hint)
    alert('Hubo un error al enviar. Por favor intentá de nuevo.')
  } finally {
      setEnviando(false)
    }
  }

  // ── PANTALLA INICIO ──
  if (pantalla === 'inicio') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">📊</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Diagnóstico de Madurez Digital
          </h1>
          <p className="text-gray-500 mb-2">20 preguntas · 5 minutos</p>
          <p className="text-gray-600 mb-8">
            Descubrí en qué nivel digital está tu empresa y qué pasos concretos podés dar para crecer.
          </p>
          <button
            onClick={handleInicio}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Comenzar diagnóstico
          </button>
          <p className="text-xs text-gray-400 mt-4">Gratuito · Sin tarjeta de crédito</p>
        </div>
      </main>
    )
  }

  // ── PANTALLA CUESTIONARIO ──
  if (pantalla === 'cuestionario') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {pregunta.categoria_nombre}
              </span>
              <span className="text-xs text-gray-400">
                {preguntaActual + 1} / {totalPreguntas}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          <h2 className="text-lg font-medium text-gray-900 mb-8 leading-relaxed">
            {pregunta.texto}
          </h2>

          <div className="space-y-3 mb-8">
            {[
              { valor: 0, label: 'No, todavía no' },
              { valor: 1, label: 'Estamos empezando' },
              { valor: 2, label: 'Sí, pero de forma básica' },
              { valor: 3, label: 'Sí, lo hacemos bien' },
              { valor: 4, label: 'Sí, es parte central de nuestro negocio' },
            ].map((opcion) => (
              <button
                key={opcion.valor}
                onClick={() => handleRespuesta(opcion.valor)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm
                  ${respuestas[pregunta.id] === opcion.valor
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
              >
                {opcion.label}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handleAnterior}
              disabled={preguntaActual === 0}
              className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            {respuestas[pregunta.id] !== undefined && (
              <button
                onClick={() => handleRespuesta(respuestas[pregunta.id])}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                Siguiente →
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  // ── PANTALLA CONTACTO ──
  if (pantalla === 'contacto') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full">
          <div className="mb-8">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-4">
              <span className="text-lg">✅</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ¡Diagnóstico completo!
            </h2>
            <p className="text-gray-500 text-sm">
              Completá tus datos y te enviamos el informe con tus resultados y recomendaciones.
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Empresa</label>
              <input
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Nombre de tu empresa"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="consentimiento"
                checked={consentimiento}
                onChange={(e) => setConsentimiento(e.target.checked)}
                className="mt-0.5 accent-blue-600"
              />
              <label htmlFor="consentimiento" className="text-xs text-gray-500 leading-relaxed">
                Acepto recibir mi informe de diagnóstico y comunicaciones de Soyculto.
                Puedo darme de baja en cualquier momento.
              </label>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!nombre || !email || !empresa || !consentimiento || enviando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            {enviando ? 'Enviando...' : 'Recibir mi informe'}
          </button>
        </div>
      </main>
    )
  }

  // ── PANTALLA CONFIRMACIÓN ──
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg w-full text-center">
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">🎉</span>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          ¡Listo, {nombre}!
        </h2>
        <p className="text-gray-600 mb-2">
          Tu informe está en camino.
        </p>
        <p className="text-gray-500 text-sm">
          Revisá tu casilla <strong>{email}</strong> en los próximos minutos.
        </p>
      </div>
    </main>
  )
}