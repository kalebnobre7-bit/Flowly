import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TELEGRAM_TOKEN = "8359178148:AAGMuyNm9iwPhd0K9Eu6yXXRmIPbCsFuoo0"
const GEMINI_API_KEY = "AIzaSyB6bdmWJv-_g-whBsPjXBiUWRfayw941Ok"
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`
const YOUR_CHAT_ID = 5524418615 // Seu Chat ID pessoal

// Cliente Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseKey)

// Função para enviar mensagem no Telegram
async function sendTelegramMessage(chatId: number, text: string, parseMode = 'Markdown') {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    })
  })
  return await response.json()
}

// Função para chamar Gemini AI
async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      })
    }
  )

  const data = await response.json()
  return data.candidates[0]?.content?.parts[0]?.text || "Desculpe, não consegui processar sua mensagem."
}

// Buscar tarefas do usuário
async function getUserTasks(userId: string, date: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('day', date)

  if (error) throw error
  return data || []
}

// Adicionar tarefa
async function addTask(userId: string, taskText: string, day: string) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      user_id: userId,
      text: taskText,
      day: day,
      period: 'Tarefas',
      completed: false,
      color: 'default',
      is_habit: false
    }])
    .select()

  if (error) throw error
  return data[0]
}

// Processar comando /tarefas
async function handleTarefasCommand(userId: string, chatId: number) {
  const today = new Date().toISOString().split('T')[0]
  const tasks = await getUserTasks(userId, today)

  if (tasks.length === 0) {
    await sendTelegramMessage(chatId, "📋 Você não tem tarefas para hoje!\n\nUse /adicionar para criar uma nova tarefa.")
    return
  }

  const completed = tasks.filter(t => t.completed).length
  const total = tasks.length
  const percentage = Math.round((completed / total) * 100)

  let message = `📊 *Suas tarefas de hoje:*\n\n`
  message += `✅ Concluídas: ${completed}/${total} (${percentage}%)\n\n`

  tasks.forEach((task, index) => {
    const icon = task.completed ? '✅' : '⬜'
    message += `${icon} ${index + 1}. ${task.text}\n`
  })

  message += `\n💡 _Use /completar [número] para marcar como concluída_`

  await sendTelegramMessage(chatId, message)
}

// Processar comando /progresso
async function handleProgressoCommand(userId: string, chatId: number) {
  const today = new Date().toISOString().split('T')[0]
  const tasks = await getUserTasks(userId, today)

  const completed = tasks.filter(t => t.completed).length
  const total = tasks.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  let emoji = '⏰'
  let status = 'Hora de começar!'

  if (percentage >= 80) {
    emoji = '🎉'
    status = 'Excelente!'
  } else if (percentage >= 50) {
    emoji = '💪'
    status = 'Bom trabalho!'
  } else if (percentage >= 20) {
    emoji = '📝'
    status = 'Vamos lá!'
  }

  const message = `${emoji} *${status}*\n\n` +
    `📊 Progresso de hoje:\n` +
    `✅ ${completed}/${total} tarefas concluídas\n` +
    `📈 ${percentage}% do dia completo\n\n` +
    `_Continue assim! 🚀_`

  await sendTelegramMessage(chatId, message)
}

// Processar comando /adicionar
async function handleAdicionarCommand(userId: string, chatId: number, text: string) {
  const taskText = text.replace('/adicionar', '').trim()

  if (!taskText) {
    await sendTelegramMessage(chatId, "❌ Use: /adicionar [nome da tarefa]\n\nExemplo: /adicionar Estudar React")
    return
  }

  const today = new Date().toISOString().split('T')[0]
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const dayName = days[new Date().getDay()]

  await addTask(userId, taskText, dayName)
  await sendTelegramMessage(chatId, `✅ *Tarefa adicionada!*\n\n📝 "${taskText}"\n\n_Acesse o Flowly para visualizar_`)
}

// Processar mensagem com IA
async function handleAIMessage(userId: string, chatId: number, messageText: string) {
  const today = new Date().toISOString().split('T')[0]
  const tasks = await getUserTasks(userId, today)

  const tasksList = tasks.map((t, i) => `${i + 1}. ${t.text} ${t.completed ? '✅' : '⬜'}`).join('\n')

  const prompt = `Você é o Flowly Assistant, um assistente de produtividade inteligente.

Tarefas do usuário hoje:
${tasksList || 'Nenhuma tarefa'}

Mensagem do usuário: "${messageText}"

Responda de forma útil e motivadora. Se o usuário pedir para adicionar tarefas, criar planos ou dar sugestões, seja específico e prático. Use emojis para deixar mais amigável.

Mantenha respostas curtas (máx 200 caracteres).`

  const aiResponse = await callGemini(prompt)
  await sendTelegramMessage(chatId, aiResponse)
}

// Processar comando /completar
async function handleCompletarCommand(userId: string, chatId: number, text: string) {
  const taskNumber = parseInt(text.replace('/completar', '').trim())

  if (isNaN(taskNumber)) {
    await sendTelegramMessage(chatId, "❌ Use: /completar [número]\n\nExemplo: /completar 1")
    return
  }

  const today = new Date().toISOString().split('T')[0]
  const tasks = await getUserTasks(userId, today)

  if (taskNumber < 1 || taskNumber > tasks.length) {
    await sendTelegramMessage(chatId, `❌ Tarefa #${taskNumber} não encontrada!\n\nVocê tem ${tasks.length} tarefas.`)
    return
  }

  const task = tasks[taskNumber - 1]

  const { error } = await supabase
    .from('tasks')
    .update({ completed: !task.completed })
    .eq('id', task.id)

  if (error) throw error

  const status = !task.completed ? '✅ Concluída' : '⬜ Reaberta'
  await sendTelegramMessage(chatId, `${status}!\n\n📝 "${task.text}"`)
}

// Handler principal
serve(async (req) => {
  try {
    // Webhook do Telegram
    if (req.method === 'POST') {
      const update = await req.json()

      if (update.message) {
        const chatId = update.message.chat.id
        const text = update.message.text || ''
        const userId = update.message.from.id.toString()

        console.log(`Mensagem recebida de ${userId}: ${text}`)

        // Comandos
        if (text.startsWith('/start')) {
          await sendTelegramMessage(chatId,
            `🎉 *Bem-vindo ao Flowly!*\n\n` +
            `Comandos disponíveis:\n` +
            `/tarefas - Ver suas tarefas\n` +
            `/adicionar [texto] - Criar tarefa\n` +
            `/completar [número] - Marcar como concluída\n` +
            `/progresso - Ver seu progresso\n\n` +
            `Ou converse naturalmente comigo! 🤖`
          )
        } else if (text.startsWith('/tarefas')) {
          await handleTarefasCommand(userId, chatId)
        } else if (text.startsWith('/progresso')) {
          await handleProgressoCommand(userId, chatId)
        } else if (text.startsWith('/adicionar')) {
          await handleAdicionarCommand(userId, chatId, text)
        } else if (text.startsWith('/completar')) {
          await handleCompletarCommand(userId, chatId, text)
        } else {
          // Processar com IA
          await handleAIMessage(userId, chatId, text)
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // GET request - status
    return new Response(JSON.stringify({ status: 'Flowly Bot is running! 🚀' }), {
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
