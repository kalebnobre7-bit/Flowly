function getSextaTaskActions() {
  return window.FlowlyTaskActions || {};
}

function getSextaControllerDayTaskStats(dateStr) {
  const metricsApi = window.FlowlyTaskMetrics || {};
  const countTasks = metricsApi.countDayTasks || window.countDayTasks;
  if (typeof countTasks === 'function') return countTasks(dateStr);
  return { total: 0, completed: 0 };
}

function persistSextaState() {
  localStorage.setItem('flowly_sexta_state', JSON.stringify(sextaState || {}));
}

function pushSextaNote(action, text) {
  sextaState.lastAction = text;
  sextaState.notes = [
    ...(Array.isArray(sextaState.notes) ? sextaState.notes : []).slice(-7),
    {
      action,
      text,
      at: new Date().toISOString()
    }
  ];
}

function pushSextaChatMessage(role, text, meta) {
  sextaState.chatHistory = [
    ...(Array.isArray(sextaState.chatHistory) ? sextaState.chatHistory : []).slice(-11),
    {
      id: `sexta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role,
      text,
      meta: meta || '',
      at: new Date().toISOString()
    }
  ];
}

function getSextaMemories() {
  return Array.isArray(sextaState.memories) ? sextaState.memories : [];
}

function getSextaProfile() {
  const profile = sextaState && typeof sextaState.profile === 'object' ? sextaState.profile : {};
  return {
    memoryNotes: String(profile.memoryNotes || '').trim(),
    operatorRules: String(profile.operatorRules || '').trim(),
    commandStyle: String(profile.commandStyle || '').trim()
  };
}

function saveSextaProfile(nextProfile = {}) {
  const current = getSextaProfile();
  sextaState.profile = {
    memoryNotes: String(
      Object.prototype.hasOwnProperty.call(nextProfile, 'memoryNotes')
        ? nextProfile.memoryNotes
        : current.memoryNotes
    ).trim(),
    operatorRules: String(
      Object.prototype.hasOwnProperty.call(nextProfile, 'operatorRules')
        ? nextProfile.operatorRules
        : current.operatorRules
    ).trim(),
    commandStyle: String(
      Object.prototype.hasOwnProperty.call(nextProfile, 'commandStyle')
        ? nextProfile.commandStyle
        : current.commandStyle
    ).trim()
  };
  persistSextaState();
  return getSextaProfile();
}

function getSextaProfileSummary(profile = getSextaProfile()) {
  return [
    profile.memoryNotes ? `Memórias fixas: ${profile.memoryNotes}` : '',
    profile.operatorRules ? `Regras: ${profile.operatorRules}` : '',
    profile.commandStyle ? `Formato: ${profile.commandStyle}` : ''
  ]
    .filter(Boolean)
    .join(' | ');
}

function saveSextaMemory(text, source) {
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  const existing = getSextaMemories().find(
    (item) => String(item.text || '').toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return existing;

  const memory = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: normalized,
    source: source || 'manual',
    createdAt: new Date().toISOString()
  };

  sextaState.memories = [...getSextaMemories().slice(-19), memory];
  return memory;
}

function removeSextaMemory(query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return null;

  const memories = getSextaMemories();
  const target = memories.find((item) =>
    String(item.text || '').toLowerCase().includes(normalized)
  );
  if (!target) return null;

  sextaState.memories = memories.filter((item) => item.id !== target.id);
  return target;
}

function clearSextaMemories() {
  sextaState.memories = [];
}

function getSextaOperationalSnapshot() {
  const todayDate = localDateStr();
  const todayData = allTasksData[todayDate] || {};
  const pendingEntries = [];
  const completedEntries = [];

  Object.entries(todayData).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks)) return;
    tasks.forEach((task, index) => {
      if (!task || !task.text) return;
      const entry = { task, period, index, dateStr: todayDate };
      if (task.completed) completedEntries.push(entry);
      else pendingEntries.push(entry);
    });
  });

  const projects = getProjectOptions();
  const activeProjects = projects.filter(
    (project) => !project.completionDate && project.status !== 'archived'
  );
  const unpaidProjects = projects.filter(
    (project) => !project.isPaid && !project.isDraft && !project.completionDate
  );
  const lateProjects = activeProjects.filter(
    (project) => project.deadline && project.deadline < todayDate
  );
  const standaloneTasks = pendingEntries.filter((entry) => !entry.task.projectId);
  const moneyEntries = pendingEntries.filter(
    (entry) => String(entry.task.priority || '').toLowerCase() === 'money'
  );
  const followupEntries = pendingEntries.filter((entry) =>
    /follow|cobrar|cliente|whats|proposta|responder/i.test(String(entry.task.text || ''))
  );

  return {
    todayDate,
    pendingEntries,
    completedEntries,
    activeProjects,
    unpaidProjects,
    lateProjects,
    standaloneTasks,
    moneyEntries,
    followupEntries
  };
}

function buildSextaContextSummary(snapshot) {
  const safeSnapshot = snapshot || getSextaOperationalSnapshot();
  const topPending = safeSnapshot.pendingEntries.slice(0, 8).map((entry) => ({
    text: entry.task.text,
    priority: entry.task.priority || 'default',
    project: entry.task.projectName || null,
    period: entry.period
  }));
  const activeProjects = safeSnapshot.activeProjects.slice(0, 6).map((project) => ({
    name: project.name,
    client: project.clientName || null,
    deadline: project.deadline || null,
    paid: project.isPaid === true
  }));
  const memories = getSextaMemories()
    .slice(-8)
    .map((item) => item.text);
  const profile = getSextaProfile();

  return {
    date: safeSnapshot.todayDate,
    pendingCount: safeSnapshot.pendingEntries.length,
    completedCount: safeSnapshot.completedEntries.length,
    moneyCount: safeSnapshot.moneyEntries.length,
    followupCount: safeSnapshot.followupEntries.length,
    unpaidProjects: safeSnapshot.unpaidProjects.length,
    topPending,
    activeProjects,
    memories,
    profile
  };
}

async function requestSextaExternalReply(userPrompt) {
  const aiSettings = getFlowlyAISettings();
  if (!aiSettings.enabled || !aiSettings.apiKey) return null;

  const provider = String(aiSettings.provider || '').toLowerCase();
  const snapshot = getSextaOperationalSnapshot();
  const contextSummary = buildSextaContextSummary(snapshot);
  const baseHistory = (Array.isArray(sextaState.chatHistory) ? sextaState.chatHistory : [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: String(item.text || '')
    }));

  const profileSummary = getSextaProfileSummary();
  const systemContent = `${aiSettings.systemPrompt}${
    profileSummary ? `\n\nPreferências operacionais da Sexta:\n${profileSummary}` : ''
  }\n\nContexto atual do Flowly:\n${JSON.stringify(contextSummary)}`;
  const messages = [{ role: 'system', content: systemContent }, ...baseHistory];

  const model =
    provider === 'minimax' && (!aiSettings.model || aiSettings.model === 'flowly-local-ops')
      ? 'M2-her'
      : aiSettings.model;

  let endpoint = aiSettings.endpoint;
  if (!endpoint && provider === 'minimax') endpoint = 'https://api.minimax.io/v1/chat/completions';
  if (!endpoint && provider === 'openai') endpoint = 'https://api.openai.com/v1/chat/completions';
  if (!endpoint) return null;

  const payload = {
    model,
    messages,
    temperature: provider === 'minimax' ? 1.0 : 0.7,
    max_tokens: 600
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiSettings.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IA ${response.status}: ${text.slice(0, 220)}`);
  }

  const data = await response.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;

  if (!content) throw new Error('IA sem resposta em choices[0].message.content');
  return String(content).trim();
}

function buildSextaAssistantReply(prompt) {
  const question = String(prompt || '').trim();
  const lower = question.toLowerCase();
  const aiSettings = getFlowlyAISettings();
  const snapshot = getSextaOperationalSnapshot();
  const memories = getSextaMemories();
  const profileSummary = getSextaProfileSummary();
  const memoryHint =
    memories.length > 0
      ? `Memoria ativa: ${memories
          .slice(-3)
          .map((item) => item.text)
          .join(' | ')}.`
      : '';
  const profileHint = profileSummary ? `Base fixa: ${profileSummary}.` : '';
  const combinedHint = [memoryHint, profileHint].filter(Boolean).join(' ');

  if (!question) {
    return 'Me manda uma pergunta direta. Ex.: o que eu ataco agora, quais projetos estao em risco, o que esta sem projeto.';
  }

  if (/(o que|oq|que eu faco|ataco|prioridade|foco)/i.test(lower)) {
    const topMoney = snapshot.moneyEntries[0] && snapshot.moneyEntries[0].task
      ? snapshot.moneyEntries[0].task.text
      : '';
    const topPending = snapshot.pendingEntries[0] && snapshot.pendingEntries[0].task
      ? snapshot.pendingEntries[0].task.text
      : '';
    if (topMoney) {
      return `Ataca primeiro "${topMoney}". E uma tarefa com impacto direto em caixa, então vale fechar esse ciclo antes de abrir outra frente. ${combinedHint}`.trim();
    }
    if (topPending) {
      return `Eu iria em "${topPending}" agora. Fecha essa peca inteira e depois revisa o resto da fila. ${combinedHint}`.trim();
    }
    return `Hoje esta limpo. Puxa uma tarefa curta que gere tracao ou organiza amanha com 3 prioridades reais. ${combinedHint}`.trim();
  }

  if (/(projeto|projetos|risco|atras)/i.test(lower)) {
    if (snapshot.lateProjects.length > 0) {
      const names = snapshot.lateProjects.slice(0, 3).map((project) => project.name).join(', ');
      return `Projetos em risco agora: ${names}. Eu revisaria prazo, proximo passo e pendencia de cliente ainda hoje. ${combinedHint}`.trim();
    }
    if (snapshot.activeProjects.length > 0) {
      const nextProject = snapshot.activeProjects[0];
      return `Voce tem ${snapshot.activeProjects.length} projeto(s) ativo(s). O mais sensivel agora parece ser "${nextProject.name}". Vale puxar um proximo passo claro dentro dele. ${combinedHint}`.trim();
    }
    return 'Nao encontrei projeto ativo agora. Talvez seja um bom momento para transformar tarefas soltas em projetos.';
  }

  if (/(dinheiro|caixa|receita|pago|pagamento)/i.test(lower)) {
    if (snapshot.moneyEntries.length > 0) {
      return `Existem ${snapshot.moneyEntries.length} tarefa(s) com prioridade dinheiro. A primeira da fila e "${snapshot.moneyEntries[0].task.text}". ${combinedHint}`.trim();
    }
    if (snapshot.unpaidProjects.length > 0) {
      return `Nao vi tarefa de dinheiro no topo, mas ha ${snapshot.unpaidProjects.length} projeto(s) ainda nao pagos. Vale revisar cobranca e follow-up. ${combinedHint}`.trim();
    }
    return 'Nao apareceu nenhum sinal forte de caixa no momento. Se quiser, eu posso te puxar um plano de follow-up para destravar receita.';
  }

  if (/(sem projeto|solta|soltas|desorganizada|desorganizadas)/i.test(lower)) {
    if (snapshot.standaloneTasks.length === 0) {
      return 'As pendencias principais ja estao relativamente organizadas em projeto ou rotina. Nao achei tarefa solta critica agora.';
    }
    const sample = snapshot.standaloneTasks
      .slice(0, 3)
      .map((entry) => entry.task.text)
      .join(', ');
    return `Voce tem ${snapshot.standaloneTasks.length} tarefa(s) pendente(s) sem projeto. As que eu olharia primeiro: ${sample}. ${combinedHint}`.trim();
  }

  if (/(amanh|planej|semana|resumo)/i.test(lower)) {
    return `Para o proximo bloco, eu montaria assim: 3 prioridades reais, 1 follow-up que puxa cliente e 1 tarefa que mexa em caixa. Hoje voce fechou ${snapshot.completedEntries.length} e ainda tem ${snapshot.pendingEntries.length} abertas. ${combinedHint}`.trim();
  }

  if (/(memoria|lembra|lembrancas|o que voce lembra)/i.test(lower)) {
    if (memories.length === 0) {
      return 'Minha memoria esta vazia agora. Se quiser, me diga algo como: lembra que eu quero priorizar tarefas de dinheiro pela manha.';
    }
    return `O que eu tenho salvo na memoria: ${memories.map((item) => item.text).join(' | ')}.${profileHint ? ` ${profileHint}` : ''}`.trim();
  }

  if (/(ia|modelo|chatgpt|minimax|openai)/i.test(lower)) {
    if (aiSettings.enabled && aiSettings.provider !== 'local') {
      return `O conector de IA esta configurado para ${aiSettings.provider} com modelo ${aiSettings.model}. A interface ja esta pronta; o proximo passo e plugar isso num backend seguro. ${combinedHint}`.trim();
    }
    return 'No momento a Sexta esta respondendo no modo local, usando os dados do Flowly. Se quiser IA externa, configura em Ajustes > IA e depois a gente liga isso num backend.';
  }

  if (snapshot.followupEntries.length > 0) {
    return `Minha leitura: fecha primeiro "${snapshot.followupEntries[0].task.text}" ou a tarefa de maior impacto financeiro. O risco agora e deixar frente aberta demais. ${combinedHint}`.trim();
  }

  return `Minha leitura operacional e simples: corta ruido, escolhe uma frente de alavancagem e fecha antes de trocar. Se quiser, me pergunta sobre foco, projetos, dinheiro ou tarefas sem projeto. ${combinedHint}`.trim();
}

function openFlowlySettingsTab(tabId) {
  localStorage.setItem('flowly_settings_tab', tabId || 'ia');
  currentView = 'settings';
  renderView();
}

function buildSextaSuggestions() {
  const todayDate = localDateStr();
  const dayData = allTasksData[todayDate] || {};
  const allTodayTasks = [];

  Object.entries(dayData).forEach(([period, tasks]) => {
    if (!Array.isArray(tasks) || period === 'Rotina') return;
    tasks.forEach((task) => {
      if (task && task.text) allTodayTasks.push({ ...task, period });
    });
  });

  const pendingTasks = allTodayTasks.filter((task) => !task.completed);
  const completedTasks = allTodayTasks.filter((task) => task.completed);
  const suggestions = [];
  const moneyTasks = pendingTasks.filter(
    (task) => String(task.priority || '').toLowerCase() === 'money'
  );
  const followupTasks = pendingTasks.filter((task) =>
    /follow|cobrar|cliente|whats|proposta/i.test(String(task.text || ''))
  );

  if (moneyTasks.length > 0) {
    suggestions.push({
      title: 'Caixa primeiro',
      body: `Se quer puxar dinheiro, comeca por: ${moneyTasks[0].text}`
    });
  } else if (pendingTasks.length > 0) {
    suggestions.push({
      title: 'Prioridade imediata',
      body: `Ataca primeiro: ${pendingTasks[0].text}`
    });
  }

  if (followupTasks.length > 0) {
    suggestions.push({
      title: 'Cliente na mesa',
      body: `Tem follow-up aberto: ${followupTasks[0].text}`
    });
  }

  if (completedTasks.length === 0 && pendingTasks.length > 0) {
    suggestions.push({
      title: 'Momentum',
      body: 'Fecha uma tarefa curta logo no inicio para ganhar tracao.'
    });
  }

  if (pendingTasks.length >= 5) {
    suggestions.push({
      title: 'Corte de ruido',
      body: 'Tem tarefa demais aberta. Vale escolher 3 principais e ignorar o resto por agora.'
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Ritmo bom',
      body: 'Hoje esta mais limpo. Mantem o foco e evita abrir frente nova sem fechar ciclo.'
    });
  }

  return suggestions;
}

var runSextaQuickAction = function (action) {
  const actions = getSextaTaskActions();
  const suggestions = buildSextaSuggestions();

  if (action === 'focus') {
    sextaState.lastAction = suggestions[0] ? suggestions[0].body : 'Sem sugestao agora.';
  } else if (action === 'review') {
    const todayDate = localDateStr();
    const stats = getSextaControllerDayTaskStats(todayDate);
    sextaState.lastAction = `Hoje: ${stats.completed}/${stats.total} concluidas. Fecha o que ficou aberto antes de virar o dia.`;
  } else if (action === 'tomorrow') {
    sextaState.lastAction = 'Amanha: separa 3 prioridades, 1 follow-up e 1 tarefa que puxe caixa.';
  } else if (action === 'plan') {
    const todayDate = localDateStr();
    const created = [
      actions.createTask && actions.createTask(todayDate, 'Definir 3 prioridades reais do dia'),
      actions.createTask && actions.createTask(todayDate, 'Fechar 1 tarefa rapida para ganhar momentum'),
      actions.createTask && actions.createTask(todayDate, 'Atacar a tarefa de maior alavancagem sem abrir outra frente')
    ].filter(Boolean).length;

    sextaState.lastAction =
      created > 0
        ? `Criei ${created} tarefas-base para organizar tua execucao de hoje.`
        : 'Nao consegui criar novas tarefas agora.';
  }

  sextaState.suggestions = suggestions;
  pushSextaNote(action, sextaState.lastAction);
  pushSextaChatMessage('assistant', sextaState.lastAction, 'acao rapida');
  persistSextaState();
  renderSextaView();
};

var runSextaCommand = async function () {
  const input = document.getElementById('sextaCommandInput');
  if (!input) return;

  const raw = input.value.trim();
  if (!raw) return;

  const actions = getSextaTaskActions();
  const lower = raw.toLowerCase();
  const normalizedLower = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const todayDate = localDateStr();
  let responseText = '';
  let responseMeta = 'sexta';
  const createMatch = raw.match(/^(criar tarefa|cria tarefa|criar|cria|adicionar tarefa|adiciona tarefa|adicionar|adiciona|anotar|anota|nova tarefa)\s+(.+)$/i);
  const prioritizeMatch = raw.match(/^(priorizar|prioriza|colocar no topo|coloca no topo|puxa pro topo|puxa para o topo)\s+(.+)$/i);
  const completeMatch = raw.match(/^(concluir|conclui|fechar|fecha|finalizar|finaliza|resolver|resolve)\s+(.+)$/i);
  const deleteMatch = raw.match(/^(apagar|apaga|excluir|exclui|deletar|deleta|remover|remove)\s+(.+)$/i);
  const moveMatch = raw.match(/^(mover|move|jogar|joga|passar|passa)\s+(.+?)\s+para\s+(amanha|amanha|hoje)$/i);

  pushSextaChatMessage('user', raw, 'pergunta');
  persistSextaState();
  input.value = '';
  renderSextaView();

  if (
    normalizedLower.startsWith('lembrar ') ||
    normalizedLower.startsWith('lembra que ') ||
    normalizedLower.startsWith('memorizar ') ||
    normalizedLower.startsWith('guarde ')
  ) {
    const memoryText = raw
      .replace(/^lembrar\s+/i, '')
      .replace(/^lembra que\s+/i, '')
      .replace(/^memorizar\s+/i, '')
      .replace(/^guarde\s+/i, '')
      .trim();
    const memory = saveSextaMemory(memoryText, 'chat');
    responseText = memory
      ? `Guardei isso na memoria: ${memory.text}`
      : 'Nao consegui registrar essa memoria.';
  } else if (
    normalizedLower.startsWith('esquecer ') ||
    normalizedLower.startsWith('remove da memoria ')
  ) {
    const memoryQuery = raw
      .replace(/^esquecer\s+/i, '')
      .replace(/^remove da memoria\s+/i, '')
      .trim();
    const removed = removeSextaMemory(memoryQuery);
    responseText = removed
      ? `Removi da memoria: ${removed.text}`
      : 'Nao achei nada parecido na memoria para remover.';
  } else if (normalizedLower.includes('limpar memoria')) {
    clearSextaMemories();
    responseText = 'Limpei a memoria da Sexta.';
  } else if (createMatch) {
    const taskText = createMatch[2].trim();
    const handled = actions.createTask && actions.createTask(todayDate, taskText);
    responseText = handled ? `Criei a tarefa: ${taskText}` : 'Nao consegui criar essa tarefa.';
    responseMeta = 'acao executada';
  } else if (prioritizeMatch) {
    const query = prioritizeMatch[2].trim();
    const task = actions.prioritizeTask && actions.prioritizeTask(todayDate, query);
    responseText = task
      ? `Joguei "${task.text}" para o topo das prioridades de hoje.`
      : 'Nao achei uma tarefa com esse texto para priorizar.';
    responseMeta = 'acao executada';
  } else if (normalizedLower.includes('concluir proxima')) {
    const next = actions.completeNextTask && actions.completeNextTask(todayDate);
    responseText = next
      ? `Conclui a proxima tarefa pendente: ${next.task.text}`
      : 'Nao achei tarefa pendente para concluir agora.';
    responseMeta = 'acao executada';
  } else if (completeMatch) {
    const query = completeMatch[2].replace(/^(a|a tarefa|tarefa)\s+/i, '').trim();
    const completedTask = actions.completeTask && actions.completeTask(query, todayDate);
    responseText = completedTask
      ? `Marquei como concluida: ${completedTask.task.text}`
      : 'Nao achei essa tarefa para concluir.';
    responseMeta = 'acao executada';
  } else if (deleteMatch) {
    const query = deleteMatch[2].replace(/^(a|a tarefa|tarefa)\s+/i, '').trim();
    const removedTask = actions.deleteTask && actions.deleteTask(query, todayDate);
    responseText = removedTask
      ? `Apaguei a tarefa: ${removedTask.task.text}`
      : 'Nao achei essa tarefa para apagar.';
    responseMeta = 'acao executada';
  } else if (moveMatch) {
    const query = moveMatch[2].replace(/^(a|a tarefa|tarefa)\s+/i, '').trim();
    const targetDateStr =
      /amanha/i.test(moveMatch[3]) && actions.getRelativeDateStr
        ? actions.getRelativeDateStr(1)
        : todayDate;
    const movedTask =
      actions.moveTask && actions.moveTask(query, targetDateStr, 'Tarefas', todayDate);
    responseText = movedTask
      ? `Mudei "${movedTask.task.text}" para ${targetDateStr === todayDate ? 'hoje' : 'amanha'}.`
      : 'Nao achei essa tarefa para mover.';
    responseMeta = 'acao executada';
  } else if (normalizedLower.includes('foco')) {
    runSextaQuickAction('focus');
    return;
  } else if (normalizedLower.includes('amanha')) {
    runSextaQuickAction('tomorrow');
    return;
  } else if (normalizedLower.includes('planeja') || normalizedLower.includes('plano')) {
    runSextaQuickAction('plan');
    return;
  } else {
    const aiSettings = getFlowlyAISettings();
    const providerLabel =
      aiSettings.provider && aiSettings.provider !== 'local'
        ? String(aiSettings.provider).toLowerCase()
        : 'modo local';

    try {
      const externalReply = await requestSextaExternalReply(raw);
      if (externalReply) {
        responseText = externalReply;
        responseMeta = providerLabel;
      } else {
        responseText = buildSextaAssistantReply(raw);
        responseMeta = 'modo local';
      }
    } catch (error) {
      responseText = buildSextaAssistantReply(raw);
      responseMeta = 'fallback local';
      pushSextaNote(
        'ia',
        `Falha no conector ${providerLabel}: ${String(error && error.message ? error.message : 'erro desconhecido').slice(0, 180)}`
      );
    }
  }

  pushSextaNote('command', responseText);
  pushSextaChatMessage('assistant', responseText, responseMeta);
  persistSextaState();
  renderSextaView();
};

window.FlowlySexta = {
  persistSextaState,
  pushSextaNote,
  pushSextaChatMessage,
  getSextaMemories,
  getSextaProfile,
  saveSextaProfile,
  getSextaProfileSummary,
  saveSextaMemory,
  removeSextaMemory,
  clearSextaMemories,
  getSextaOperationalSnapshot,
  buildSextaContextSummary,
  requestSextaExternalReply,
  buildSextaAssistantReply,
  buildSextaSuggestions
};
