
// Retorna as datas da semana baseadas no offset
export function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Domingo
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Ajustar para segunda-feira

    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + (weekOffset * 7));
    monday.setHours(0, 0, 0, 0);

    const dates = [];
    const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push({
            name: dayNames[i],
            date: date,
            dateStr: localDateStr(date)
        });
    }

    return dates;
}

// Retorna o primeiro e último dia do mês basedo no offset
export function getMonthDates(monthOffset = 0) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + monthOffset;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return { firstDay, lastDay, month: firstDay.getMonth(), year: firstDay.getFullYear() };
}

// Retorna o label da semana (ex: 12 Jan - 18 Jan)
export function getWeekLabel(weekOffset) {
    const dates = getWeekDates(weekOffset);
    const firstDate = dates[0].date;
    const lastDate = dates[6].date;

    if (weekOffset === 0) return 'Semana Atual';

    const format = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${format(firstDate)} - ${format(lastDate)}`;
}

// Retorna a data local no formato YYYY-MM-DD (sem bug de fuso horário UTC)
export function localDateStr(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
