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

  function fixMojibakeText(value) {
    if (typeof value !== 'string' || value.length === 0) return value;

    const replacements = [
      ['MarÃ§o', 'Março'],
      ['MÃªs', 'Mês'],
      ['SÃ¡b', 'Sáb'],
      ['SÃ¡bado', 'Sábado'],
      ['TerÃ§a', 'Terça'],
      ['concluÃ­das', 'concluídas'],
      ['ConcluÃ­dos', 'Concluídos'],
      ['hÃ¡bito', 'hábito'],
      ['hÃ¡bitos', 'hábitos'],
      ['HÃ¡bitos', 'Hábitos'],
      ['HistÃ³rico', 'Histórico'],
      ['mÃ©dia', 'média'],
      ['Ãºltima', 'última'],
      ['Ãºltimos', 'últimos'],
      ['Ãºltimo', 'último'],
      ['consistÃªncia', 'consistência'],
      ['ConsistÃªncia', 'Consistência'],
      ['ConclusÃ£o', 'Conclusão'],
      ['conclusÃ£o', 'conclusão'],
      ['VocÃª', 'Você'],
      ['estÃ¡vel', 'estável'],
      ['AnÃ¡lise', 'Análise'],
      ['EstratÃ©gica', 'Estratégica'],
      ['diÃ¡rio', 'diário'],
      ['Ã ', 'à'],
      ['Ã©', 'é'],
      ['Ã¡', 'á'],
      ['Ãª', 'ê'],
      ['Ã£', 'ã'],
      ['Ã³', 'ó'],
      ['Ãº', 'ú'],
      ['Ã§', 'ç'],
      ['â€¢', '•'],
      ['Â·', '·'],
      ['â†‘', '↑'],
      ['â†“', '↓'],
      ['â†—', '↗'],
      ['â‰ˆ', '≈'],
      ['â€”', '—'],
      ['â€“', '–']
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
    fixMojibakeText
  };
  window.safeJSONParse = safeJSONParse;
  window.localDateStr = localDateStr;
  window.formatElapsedShort = formatElapsedShort;
  window.formatDurationClock = formatDurationClock;
  window.fixMojibakeText = fixMojibakeText;
})();
