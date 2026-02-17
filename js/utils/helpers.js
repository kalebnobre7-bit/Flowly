
// Helper para JSON seguro
export function safeJSONParse(str, fallback) {
    try {
        return str ? JSON.parse(str) : fallback;
    } catch (e) {
        console.error('Erro ao fazer parse do JSON:', e);
        return fallback;
    }
}
