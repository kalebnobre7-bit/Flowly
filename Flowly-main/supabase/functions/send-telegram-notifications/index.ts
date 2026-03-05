import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TELEGRAM_TOKEN = "8359178148:AAGMuyNm9iwPhd0K9Eu6yXXRmIPbCsFuoo0"
const YOUR_CHAT_ID = 5524418615
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`

// Cliente Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

// Função para enviar mensagem no Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  })
  return await response.json()
}

// Buscar tarefas do usuário
async function getUserTasks(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const dayName = days[new Date().getDay()]

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('day', dayName)

  if (error) throw error
  return data || []
}

// Handler principal
serve(async (req) => {
  try {
    const { type, userId } = await req.json()

    const tasks = await getUserTasks(userId || YOUR_CHAT_ID.toString())
    const completed = tasks.filter(t => t.completed).length
    const total = tasks.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    let message = ''

    switch (type) {
      case 'morning': // 9h
        message = `☀️ *Bom dia!*\n\n`
        if (total > 0) {
          message += `Você tem *${total} tarefas* para hoje:\n\n`
          tasks.slice(0, 5).forEach((task, i) => {
            message += `${i + 1}. ${task.text}\n`
          })
          if (total > 5) {
            message += `\n_...e mais ${total - 5} tarefas_\n`
          }
        } else {
          message += `Sem tarefas para hoje! 🎉\n\n_Use /adicionar para criar uma_`
        }
        message += `\n💪 Tenha um dia produtivo!`
        break

      case 'afternoon': // 15h
        if (total === 0) {
          message = `📊 *Como está o progresso?*\n\nVocê ainda não tem tarefas cadastradas para hoje.\n\n_Use /adicionar para criar_`
        } else if (percentage === 100) {
          message = `🎉 *Parabéns!*\n\nVocê já completou todas as tarefas!\n\n✅ ${completed}/${total} concluídas`
        } else {
          message = `📊 *Como está o progresso?*\n\n` +
            `✅ ${completed}/${total} tarefas concluídas (${percentage}%)\n\n` +
            `${total - completed} tarefas restantes para hoje!`
        }
        break

      case 'evening': // 20h
        if (total === 0) {
          message = `⏰ *Última chance!*\n\nNão há tarefas pendentes. Aproveite sua noite! 🌙`
        } else if (percentage === 100) {
          message = `🎉 *Incrível!*\n\nTodas as tarefas concluídas!\n\nMereça um descanso! ✨`
        } else {
          const remaining = total - completed
          message = `⏰ *Última chance!*\n\n` +
            `Ainda faltam *${remaining} tarefas*:\n\n`

          tasks.filter(t => !t.completed).slice(0, 3).forEach((task, i) => {
            message += `⬜ ${task.text}\n`
          })

          message += `\n_Ainda dá tempo! 💪_`
        }
        break

      case 'summary': // 23h
        const emoji = percentage >= 80 ? '🎉' : percentage >= 50 ? '💪' : percentage >= 20 ? '📝' : '😴'
        let status = ''

        if (percentage >= 80) status = 'Excelente dia!'
        else if (percentage >= 50) status = 'Bom trabalho!'
        else if (percentage >= 20) status = 'Progresso moderado'
        else status = 'Amanhã é um novo dia!'

        message = `🌙 *Resumo do dia*\n\n` +
          `${emoji} *${status}*\n\n` +
          `📊 Você completou:\n` +
          `✅ ${completed}/${total} tarefas (${percentage}%)\n\n`

        if (percentage >= 80) {
          message += `Continue assim! 🚀`
        } else if (percentage >= 50) {
          message += `Amanhã você consegue 100%! 💪`
        } else {
          message += `Não desista! Todo progresso conta! ✨`
        }
        break
    }

    await sendTelegramMessage(YOUR_CHAT_ID, message)

    return new Response(JSON.stringify({ ok: true, message: 'Notification sent!' }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
