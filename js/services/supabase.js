
const SUPABASE_URL = 'https://cgrosyjtujakkbjjnmml.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNncm9zeWp0dWpha2tiampubW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTA0NzcsImV4cCI6MjA4NjU4NjQ3N30.MsDw0nSiLF1jHWMuVGRgTT6gNUeK328RvGBo-YcFG1A';

// Verificar se o Supabase foi carregado globalmente via CDN
const client = window.supabase ? window.supabase.createClient : null;

if (!client) {
    console.error('Supabase client not loaded');
}

// Inicializar flowly_persist_session como true por padrão (checkbox vem marcado)
if (localStorage.getItem('flowly_persist_session') === null) {
    localStorage.setItem('flowly_persist_session', 'true');
}

const customStorage = {
    getItem: (key) => {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        // console.log('[Storage] getItem:', key, value ? 'found' : 'not found');
        return value;
    },
    setItem: (key, value) => {
        const shouldPersist = localStorage.getItem('flowly_persist_session') !== 'false';
        // console.log('[Storage] setItem:', key, 'persist:', shouldPersist);
        if (shouldPersist) {
            localStorage.setItem(key, value);
        } else {
            sessionStorage.setItem(key, value);
        }
    },
    removeItem: (key) => {
        // console.log('[Storage] removeItem:', key);
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
};

export const supabaseClient = client ? client(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'flowly-auth'
    }
}) : null;
