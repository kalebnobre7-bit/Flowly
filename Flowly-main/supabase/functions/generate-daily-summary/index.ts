import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const url = new URL(req.url);
        const mode = url.searchParams.get('mode') || 'default';

        // 1. Setup Locale Information (America/Sao_Paulo)
        const spLocalString = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const options = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
        const dateParts = new Intl.DateTimeFormat('pt-BR', options).formatToParts(new Date());

        const year = dateParts.find(p => p.type === 'year')?.value;
        const month = dateParts.find(p => p.type === 'month')?.value;
        const day = dateParts.find(p => p.type === 'day')?.value;
        const todayStr = `${year}-${month}-${day}`;

        const spDateForWeekday = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const todayDayOfWeek = spDateForWeekday.getDay(); // 0 (Dom) a 6 (Sáb)

        // Supabase Auth and Init
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabaseClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: req.headers.get('Authorization')! } }
        });

        const { data: { user } } = await supabaseClient.auth.getUser();
        let userId = user?.id;
        if (!userId) {
            const requestData = await req.json().catch(() => ({}));
            userId = requestData.user_id;
        }

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Falha na autenticação ou user_id ausente.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Data Fetching
        const { data: tasks, error: tasksError } = await supabaseClient
            .from('tasks')
            .select('id, text, day, period, completed, color, type')
            .eq('user_id', userId)
            .in('day', [todayStr, 'RECURRING']);

        if (tasksError) throw tasksError;

        const { data: habitsHistory, error: habitsError } = await supabaseClient
            .from('habits_history')
            .select('habit_name, completed')
            .eq('user_id', userId)
            .eq('date', todayStr);

        if (habitsError) throw habitsError;

        const completedRoutinesSet = new Set(
            (habitsHistory || []).filter(h => h.completed !== false).map(h => h.habit_name)
        );

        // 3. Process task types and calculate score
        let total = 0, completed = 0;
        let moneyCompleted = 0, bodyCompleted = 0, mindCompleted = 0, operationalCompleted = 0, spiritCompleted = 0;

        (tasks || []).forEach(task => {
            let isTaskForToday = false;
            let isTaskCompleted = false;

            if (task.day === todayStr) {
                isTaskForToday = true;
                isTaskCompleted = task.completed === true;
            } else if (task.day === 'RECURRING') {
                try {
                    const scheduledDays = JSON.parse(task.period || '[]');
                    if (Array.isArray(scheduledDays) && scheduledDays.includes(todayDayOfWeek)) {
                        isTaskForToday = true;
                        isTaskCompleted = completedRoutinesSet.has(task.text);
                    }
                } catch (e) { }
            }

            if (isTaskForToday) {
                total++;
                if (isTaskCompleted) {
                    completed++;
                    const tType = task.type || 'OPERATIONAL';
                    if (tType === 'MONEY') moneyCompleted++;
                    if (tType === 'BODY') bodyCompleted++;
                    if (tType === 'MIND') mindCompleted++;
                    if (tType === 'OPERATIONAL') operationalCompleted++;
                    if (tType === 'SPIRIT') spiritCompleted++;
                }
            }
        });

        const score = (moneyCompleted * 3) + (bodyCompleted * 3) + (mindCompleted * 2) + (operationalCompleted * 1) + (spiritCompleted * 1);
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        const remaining = total - completed;

        // 4. Validate Day Logic
        let dayValidated = false;
        if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
            // Segunda a Sexta
            if (moneyCompleted >= 2 && bodyCompleted >= 1 && score >= 8) dayValidated = true;
        } else if (todayDayOfWeek === 6) {
            // Sábado
            if (moneyCompleted >= 1 && (bodyCompleted >= 1 || mindCompleted >= 1) && score >= 5) dayValidated = true;
        } else if (todayDayOfWeek === 0) {
            // Domingo
            if (spiritCompleted >= 1) dayValidated = true;
        }

        const summary = {
            total,
            completed,
            remaining,
            percentage,
            score,
            moneyCompleted,
            bodyCompleted,
            mindCompleted,
            operationalCompleted,
            spiritCompleted,
            dayValidated
        };

        // 5. Build Dynamic Messages based on Trainer Logic
        let telegramText = '';

        if (mode === 'morning') {
            telegramText = `🌅 Flowly — Início de Jogo\n\nTotal de tarefas hoje: ${total}\nTipo MONEY pautadas: Mapeadas no sistema.\n\nTreinador: Escolha suas 3 tarefas críticas agora. Direcione o esforço para onde gera mais valor.`;
        }
        else if (mode === 'midday') {
            let msg = percentage >= 40
                ? 'Progresso consistente! Mantenha a cadência na parte da tarde. 🎯'
                : 'Cuidado com a distração. Reajuste a rota agora e foque no que importa. ⚠️';
            telegramText = `☀️ Flowly — Check-in de Meio-Dia\n\nPercentual concluído: ${percentage}%\nPontuação atual: ${score}\n\nTreinador: ${msg}`;
        }
        else if (mode === 'evening') {
            let msg = dayValidated
                ? 'Dia validado com sucesso! Use o resto da tarde para adiantar ou descanse.'
                : 'Seu dia ainda não foi validado. Penúltima chance. Foque no essencial e feche a conta. ⏱️';
            telegramText = `🌆 Flowly — Fim de Tarde\n\nPercentual concluído: ${percentage}%\nPontuação Acumulada: ${score}\n\nTreinador: ${msg}`;
        }
        else if (mode === 'night') {
            let trainerMsg = '';
            if (dayValidated) {
                trainerMsg = 'Excelente trabalho! Identidade de um profissional disciplinado totalmente reforçada. Consistência é o jogo. 🏆';
            } else {
                if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
                    if (score < 5) {
                        trainerMsg = 'A pontuação ficou muito baixa hoje. Assuma o controle, revise a falha sem se culpar, e amanhã comece resolvendo o atraso.';
                    } else if (moneyCompleted < 2) {
                        trainerMsg = 'Houve atividade hoje, mas o motor principal falhou. Sem geração de caixa (MONEY) ou proteção de pilar, o progresso empaca. Ajuste isso amanhã.';
                    } else if (bodyCompleted < 1) {
                        trainerMsg = 'Você entregou, mas falhou na premissa BODY. Disciplina física é a base da performance orgânica. Não pule essa de novo.';
                    } else {
                        trainerMsg = 'Bateu na trave. O dia não validou pelos requisitos da matriz. Treine focar nas alavancas corretas.';
                    }
                } else {
                    trainerMsg = 'Finalize a semana sem deixar pendências emocionais. Aprenda e reinicie o ciclo forte amanhã.';
                }
            }

            telegramText = `🌙 Flowly — Resumo de Performance\n\nTotal Diário: ${total}\nConcluídas: ${completed}\nEficiência: ${percentage}%\nScore de Peso: ${score}\nSituação Final: ${dayValidated ? '🟢 DIA VALIDADO' : '🔴 DIA NÃO VALIDADO'}\n\n[M]oney: ${moneyCompleted}\n[B]ody: ${bodyCompleted}\n[M]ind: ${mindCompleted}\n[O]perational: ${operationalCompleted}\n[S]pirit: ${spiritCompleted}\n\nTreinador: ${trainerMsg}`;
        }
        else {
            let msg = dayValidated ? 'Dia Validado Parabéns! 🏆' : 'Faltou um empurrão nas metas hoje. 💪';
            telegramText = `🌅 Flowly — Resumo Atual\nTotal: ${total}\nConcluídas: ${completed}\nPercentual: ${percentage}%\nPontuação: ${score}\nStatus: ${dayValidated ? 'VALIDADO' : 'NÃO VALIDADO'}\n\nMENSAGEM: ${msg}`;
        }

        // 6. Send to Telegram
        const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');
        let telegramSent = false;

        if (telegramBotToken && telegramChatId) {
            try {
                const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: telegramChatId, text: telegramText })
                });
                if (tgRes.ok) telegramSent = true;
            } catch (err) {
                console.error('Erro ao chamar API do Telegram:', err);
            }
        }

        return new Response(JSON.stringify({ ...summary, telegramSent }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
