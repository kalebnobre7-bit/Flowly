// View extra?da de app.js
function renderMonth() {
  const view = document.getElementById('monthView');
  const { firstDay, lastDay, month, year } = getMonthDates(currentMonthOffset);

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'MarÃ§o',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ].map((item) => (typeof fixMojibakeText === 'function' ? fixMojibakeText(item) : item));
  const currentMonthLabel =
    typeof fixMojibakeText === 'function' ? fixMojibakeText('MÃªs Atual') : 'Mês Atual';
  const saturdayLabel =
    typeof fixMojibakeText === 'function' ? fixMojibakeText('SÃ¡b') : 'Sáb';

  let html = `
                
                
                
                
                
                
                
                <div class="flowly-shell flowly-shell--wide">
                
                
                
                
                
                
                
                    <div class="flex items-center justify-center gap-4 mb-6">
                
                
                
                
                
                
                
                        <button type="button" data-month-nav="-1" class="utility-btn">
                
                
                
                
                
                
                
                            <i data-lucide="chevron-left" style="width: 18px; height: 18px;"></i>
                
                
                
                
                
                
                
                        </button>
                
                
                
                
                
                
                
                        <h2 class="text-2xl font-bold text-white min-w-[200px] text-center">
                
                
                
                
                
                
                
                            ${monthNames[month]} ${year}
                
                
                
                
                
                
                
                        </h2>
                
                
                
                
                
                
                
                        <button type="button" data-month-nav="1" class="utility-btn">
                
                
                
                
                
                
                
                            <i data-lucide="chevron-right" style="width: 18px; height: 18px;"></i>
                
                
                
                
                
                
                
                        </button>
                
                
                
                
                
                
                
                        <button type="button" data-month-nav="current" class="btn-secondary text-xs px-3 py-1 ml-4" style="width: auto; padding: 6px 12px;">
                
                
                
                
                
                
                
                            ${currentMonthLabel}
                
                
                
                
                
                
                
                        </button>
                
                
                
                
                
                
                
                    </div>

                
                
                
                
                
                
                
                    <!-- CabeÃ§alho dos dias da semana -->
                
                
                
                
                
                
                
                    <div class="grid grid-cols-7 gap-2 mb-2">
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Seg</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Ter</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qua</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Qui</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Sex</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">${saturdayLabel}</div>
                
                
                
                
                
                
                
                        <div class="text-center text-xs font-semibold text-gray-500 uppercase">Dom</div>
                
                
                
                
                
                
                
                    </div>

                
                
                
                
                
                
                
                    <!-- Grid do calendÃ¡rio -->
                
                
                
                
                
                
                
                    <div class="grid grid-cols-7 gap-2">
            `;

  // Calcular o primeiro dia da semana (segunda = 0)
  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  // Preencher dias vazios antes do primeiro dia
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-30 rounded-lg"></div>`;
  }

  // Preencher os dias do mÃªs
  const today = localDateStr();
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dateStr = localDateStr(date);
    const isToday = dateStr === today;

    const dayTasks = allTasksData[dateStr] || {};
    let totalTasks = 0;
    let completedTasks = 0;
    const completedTaskNames = [];

    // Conjunto de textos ignorados (recorrentes e rotinas)
    const ignoredTexts = new Set([
      ...weeklyRecurringTasks.map((t) => t.text),
      ...dailyRoutine.map((t) => t.text)
    ]);

    // Contar apenas tarefas normais persistidas (excluir perÃ­odo 'Rotina' e tarefas que sÃ£o cÃ³pias de recorrentes)
    Object.entries(dayTasks).forEach(([period, tasks]) => {
      if (period === 'Rotina') return;
      if (Array.isArray(tasks)) {
        // Filtra tarefas que nÃ£o sÃ£o recorrentes
        const validTasks = tasks.filter((t) => !ignoredTexts.has(t.text));
        totalTasks += validTasks.length;
        completedTasks += validTasks.filter((t) => t.completed).length;
        validTasks.forEach((t) => {
          if (t && t.completed && t.text) completedTaskNames.push(String(t.text));
        });
      }
    });

    const completedRoutineNames = getRoutineTasksForDate(dateStr)
      .filter((t) => t && t.completed && t.text)
      .map((t) => String(t.text));
    completedRoutineNames.forEach((name) => completedTaskNames.push(name));

    const uniqueCompletedTaskNames = [...new Set(completedTaskNames)];
    const previewMaxItems = 6;
    const previewItems = uniqueCompletedTaskNames.slice(0, previewMaxItems);
    const previewMore = uniqueCompletedTaskNames.length - previewItems.length;
    const monthDayTooltip =
      uniqueCompletedTaskNames.length > 0
        ? `Concluidas: ${uniqueCompletedTaskNames.length}\n${previewItems.map((name) => `- ${name}`).join('\n')}${previewMore > 0 ? `\n+${previewMore} outras` : ''}`
        : 'Nenhuma tarefa concluida neste dia';
    const monthDayTooltipAttr = monthDayTooltip
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '&#10;');

    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    html += `
                
                
                
                
                
                
                
                    <div class="min-h-[120px] bg-[#1c1c1e] bg-opacity-40 rounded-lg p-3 hover:bg-opacity-60 transition-all cursor-pointer border ${isToday ? 'border-blue-500' : 'border-white/5'}"
                
                
                
                
                
                
                
                         title="${monthDayTooltipAttr}"
                         data-go-to-date="${dateStr}">
                
                
                
                
                
                
                
                        <div class="flex items-center justify-between mb-2">
                
                
                
                
                
                
                
                            <div class="text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-white'}">${day}</div>
                
                
                
                
                
                
                
                            ${
                              totalTasks > 0
                                ? `
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div class="text-xs text-gray-500">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                    ${completedTasks}/${totalTasks}
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                </div>
                
                
                
                
                
                
                
                            `
                                : ''
                            }
                
                
                
                
                
                
                
                        </div>

                
                
                
                
                
                
                
                        ${
                          totalTasks > 0
                            ? `
                
                
                
                
                
                
                
                            <div class="w-full h-1 bg-gray-700/30 rounded-full overflow-hidden mb-2">
                
                
                
                
                
                
                
                                
                
                
                
                
                
                
                <div class="h-full bg-blue-500 rounded-full transition-all" style="width: ${completionPercent}%"></div>
                
                
                
                
                
                
                
                            </div>
                
                
                
                
                
                
                
                        `
                            : ''
                        }

                
                
                
                
                
                
                
                        <div class="text-xs text-gray-600 space-y-1">
                
                
                
                
                
                
                
                            ${totalTasks === 0 ? '<div class="text-center py-4 text-gray-700">Sem tarefas</div>' : ''}
                
                
                
                
                
                
                
                        </div>
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                `;
  }

  html += `
                
                
                
                
                
                
                
                    </div>
                
                
                
                
                
                
                
                </div>
            `;

  view.innerHTML = typeof fixMojibakeText === 'function' ? fixMojibakeText(html) : html;

  view.querySelectorAll('[data-month-nav]').forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.monthNav;
      if (action === 'current') currentMonthOffset = 0;
      else currentMonthOffset += Number(action || 0);
      renderView();
    };
  });

  view.querySelectorAll('[data-go-to-date]').forEach((dayCard) => {
    dayCard.onclick = () => {
      const dateStr = dayCard.dataset.goToDate;
      if (dateStr) goToDate(dateStr);
    };
  });
}

