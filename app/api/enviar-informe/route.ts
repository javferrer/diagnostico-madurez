import { NextRequest, NextResponse } from 'next/server'

const NIVELES = {
  1: {
    titulo: 'Nivel 1 — Inicial',
    descripcion: 'Tu empresa está dando los primeros pasos en la digitalización. Hay una gran oportunidad de crecimiento.',
    recomendaciones: [
      'Creá un sitio web básico con información de tu empresa y servicios.',
      'Abrí perfiles en las redes sociales donde está tu cliente ideal.',
      'Usá Google Workspace o Microsoft 365 para gestionar el trabajo en equipo.',
      'Registrá tu empresa en Google My Business para aparecer en búsquedas locales.',
    ]
  },
  2: {
    titulo: 'Nivel 2 — En desarrollo',
    descripcion: 'Tenés presencia digital básica pero todavía hay procesos clave sin digitalizar.',
    recomendaciones: [
      'Implementá una herramienta de gestión de tareas como Notion o Trello.',
      'Empezá a medir el tráfico de tu sitio web con Google Analytics.',
      'Explorá opciones para recibir pagos digitales.',
      'Documentá tus procesos internos más importantes.',
    ]
  },
  3: {
    titulo: 'Nivel 3 — Avanzado',
    descripcion: 'Tu empresa tiene una base digital sólida. El foco ahora es optimizar y automatizar.',
    recomendaciones: [
      'Implementá un CRM para gestionar mejor tus clientes y oportunidades.',
      'Automatizá procesos repetitivos como facturación o reportes.',
      'Creá una estrategia de email marketing para nutrir tus leads.',
      'Usá dashboards para tomar decisiones basadas en datos.',
    ]
  },
  4: {
    titulo: 'Nivel 4 — Líder digital',
    descripcion: 'Tu empresa es un referente en madurez digital. El desafío es mantenerse a la vanguardia.',
    recomendaciones: [
      'Explorá herramientas de inteligencia artificial para optimizar operaciones.',
      'Desarrollá capacidades de análisis predictivo.',
      'Construí una cultura de innovación digital continua.',
      'Considerá monetizar tu conocimiento digital ayudando a otros.',
    ]
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, email, empresa, scoreTotal, nivel } = await req.json()

    const nivelInfo = NIVELES[nivel as keyof typeof NIVELES]

    const recomendacionesHtml = nivelInfo.recomendaciones
      .map(r => `<li style="margin-bottom: 8px;">${r}</li>`)
      .join('')

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1d4ed8;">Tu Diagnóstico de Madurez Digital</h1>
        <p>Hola <strong>${nombre}</strong>,</p>
        <p>Completaste el diagnóstico de madurez digital para <strong>${empresa}</strong>. Acá están tus resultados:</p>
        
        <div style="background: #f0f9ff; border-left: 4px solid #1d4ed8; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <div style="font-size: 32px; font-weight: bold; color: #1d4ed8;">${scoreTotal}/100</div>
          <div style="font-size: 18px; font-weight: 600; color: #1e3a5f; margin-top: 4px;">${nivelInfo.titulo}</div>
          <p style="color: #475569; margin-top: 8px;">${nivelInfo.descripcion}</p>
        </div>

        <h2 style="color: #1e3a5f;">Recomendaciones para tu empresa</h2>
        <ul style="color: #475569; line-height: 1.6;">
          ${recomendacionesHtml}
        </ul>

        <div style="margin-top: 32px; padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center;">
          <p style="font-weight: 600; color: #1e3a5f;">¿Querés saber cómo avanzar al siguiente nivel?</p>
          <a href="https://soyculto.com?utm_source=informe&utm_medium=email&utm_campaign=diagnostico" 
             style="display: inline-block; background: #1d4ed8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 8px;">
            Agendá una llamada gratuita
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; text-align: center;">
          Soyculto · Si no querés recibir más emails, 
          <a href="{{unsubscribe}}" style="color: #94a3b8;">date de baja aquí</a>
        </p>
      </div>
    `

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender: {
          name: 'Diagnostico Digital',
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email, name: nombre }],
        subject: `Tu diagnóstico de madurez digital — ${nivelInfo.titulo}`,
        htmlContent,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(JSON.stringify(error))
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Error enviando informe:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}