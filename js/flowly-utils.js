(function () {
  function safeJSONParse(str, fallback) {
    if (typeof localStore !== 'undefined' && localStore && typeof localStore.safeJSONParse === 'function') {
      return localStore.safeJSONParse(str, fallback);
    }
    try {
      return str ? JSON.parse(str) : fallback;
    } catch (e) {
      console.error('Erro ao fazer parse do JSON:', e);
      return fallback;
    }
  }

  function localDateStr(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatElapsedShort(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return 'agora';

    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      if (hours > 0) return `${days}d ${hours}h`;
      return `${days}d`;
    }

    if (hours > 0) {
      if (minutes > 0) return `${hours}h ${minutes}m`;
      return `${hours}h`;
    }

    return `${Math.max(1, minutes)}m`;
  }

  function formatDurationClock(ms) {
    const safeMs = Math.max(0, Number(ms) || 0);
    const totalSeconds = Math.floor(safeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function generateFlowlyId(prefix = 'flowly') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getRecurringTaskIdentity(task) {
    if (!task) return '';
    if (typeof task === 'string') return String(task).trim();
    return String(task.routineId || task.routineKey || task.supabaseId || task.id || task.text || '').trim();
  }

  function ensureRecurringTaskIdentity(task) {
    if (!task || typeof task !== 'object') return '';

    const existing = String(task.routineId || '').trim();
    if (existing) {
      task.routineId = existing;
      return existing;
    }

    const remoteId = String(task.supabaseId || task.id || '').trim();
    if (remoteId) {
      task.routineId = remoteId;
      return task.routineId;
    }

    task.routineId = generateFlowlyId('routine');
    return task.routineId;
  }

  function normalizeRecurringTasksList(list) {
    const source = Array.isArray(list) ? list : [];

    return source.reduce(function (acc, task, index) {
      if (!task || typeof task !== 'object') return acc;
      if (!task._deletedPending && !String(task.text || '').trim()) return acc;

      if (typeof task.text === 'string') {
        task.text = task.text.trim();
      }
      if (!Array.isArray(task.daysOfWeek)) {
        task.daysOfWeek = [];
      }
      if (!task.createdAt || Number.isNaN(new Date(task.createdAt).getTime())) {
        task.createdAt = new Date().toISOString();
      }

      ensureRecurringTaskIdentity(task);

      if (!Number.isFinite(Number(task.order))) {
        task.order = index;
      } else {
        task.order = Number(task.order);
      }

      acc.push(task);
      return acc;
    }, []);
  }

  function findRecurringTaskIndex(list, needle) {
    const items = Array.isArray(list) ? list : [];
    const targetId = getRecurringTaskIdentity(needle);

    if (targetId) {
      return items.findIndex(function (task) {
        return getRecurringTaskIdentity(task) === targetId;
      });
    }

    const fallbackText =
      typeof needle === 'string' ? String(needle).trim() : String((needle && needle.text) || '').trim();
    if (!fallbackText) return -1;

    return items.findIndex(function (task) {
      return String((task && task.text) || '').trim() === fallbackText;
    });
  }

  function findRecurringTask(list, needle) {
    const index = findRecurringTaskIndex(list, needle);
    if (index < 0) return null;
    return list[index] || null;
  }

  function fixMojibakeText(value) {
    if (typeof value !== 'string' || value.length === 0) return value;

    const replacements = [
      ['Março', 'Março'],
      ['Mês', 'Mês'],
      ['Sáb', 'Sáb'],
      ['Sábado', 'Sábado'],
      ['Terça', 'Terça'],
      ['concluídas', 'concluídas'],
      ['Concluídos', 'Concluídos'],
      ['hábito', 'hábito'],
      ['hábitos', 'hábitos'],
      ['Hábitos', 'Hábitos'],
      ['Histórico', 'Histórico'],
      ['média', 'média'],
      ['última', 'última'],
      ['últimos', 'últimos'],
      ['último', 'último'],
      ['consistência', 'consistência'],
      ['Consistência', 'Consistência'],
      ['Conclusão', 'Conclusão'],
      ['conclusão', 'conclusão'],
      ['Você', 'Você'],
      ['estável', 'estável'],
      ['Análise', 'Análise'],
      ['Estratégica', 'Estratégica'],
      ['diário', 'diário'],
      ['à', 'à'],
      ['é', 'é'],
      ['á', 'á'],
      ['ê', 'ê'],
      ['ã', 'ã'],
      ['ó', 'ó'],
      ['ú', 'ú'],
      ['ç', 'ç'],
      ['•', '•'],
      ['Â·', '·'],
      ['â†‘', '↑'],
      ['â†“', '↓'],
      ['â†—', '↗'],
      ['â‰ˆ', '≈'],
      ['—', '—'],
      ['–', '–']
    ];

    let next = value;
    replacements.forEach(function ([from, to]) {
      next = next.split(from).join(to);
    });
    return next;
  }

  window.FlowlyUtils = {
    safeJSONParse,
    localDateStr,
    formatElapsedShort,
    formatDurationClock,
    generateFlowlyId,
    getRecurringTaskIdentity,
    ensureRecurringTaskIdentity,
    normalizeRecurringTasksList,
    findRecurringTaskIndex,
    findRecurringTask,
    fixMojibakeText
  };
  window.safeJSONParse = safeJSONParse;
  window.localDateStr = localDateStr;
  window.formatElapsedShort = formatElapsedShort;
  window.formatDurationClock = formatDurationClock;
  window.generateFlowlyId = generateFlowlyId;
  window.getRecurringTaskIdentity = getRecurringTaskIdentity;
  window.ensureRecurringTaskIdentity = ensureRecurringTaskIdentity;
  window.normalizeRecurringTasksList = normalizeRecurringTasksList;
  window.findRecurringTaskIndex = findRecurringTaskIndex;
  window.findRecurringTask = findRecurringTask;
  window.fixMojibakeText = fixMojibakeText;
})();
