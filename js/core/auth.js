
import { supabaseClient } from '../services/supabase.js';

let currentUser = null;

// Callbacks
let authStateListeners = [];

export function onAuthStateChange(callback) {
    if (typeof callback === 'function') {
        authStateListeners.push(callback);
    }
}

export function getCurrentUser() {
    return currentUser;
}

// Inicializar listener do Supabase
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event, session);

        if (event === 'INITIAL_SESSION' && session) {
            currentUser = session.user;
        } else if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
        }

        // Notificar listeners
        authStateListeners.forEach(cb => cb(event, session));
    });
}

// Funções de auth
export async function checkAuth() {
    console.log('[Auth] Checking auth...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    console.log('[Auth] Session:', session ? 'found' : 'not found', error);
    return { session, error };
}

export async function signUp(email, password) {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    return { error };
}

export async function signIn(email, password, keepLoggedIn) {
    localStorage.setItem('flowly_persist_session', keepLoggedIn.toString());
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    return { data, error };
}

export async function signOut() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    location.reload();
}
