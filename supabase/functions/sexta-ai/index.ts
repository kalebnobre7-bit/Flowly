import {
  buildSextaContextSummary,
  clearSextaMemories,
  createSupabaseAdminClient,
  getAuthenticatedUser,
  handleCors,
  jsonResponse,
  loadSextaAgentState,
  normalizeSextaProfile,
  removeSextaMemory,
  runSextaAgentLoop,
  saveSextaMemory,
  saveSextaProfile
} from '../_shared/sexta.ts';

function normalizeHistory(rawHistory: unknown) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        role: String(entry.role || '').trim(),
        content: String(entry.content || '').trim()
      };
    })
    .filter((item) => item.role && item.content)
    .slice(-8);
}

function normalizeMemories(rawMemories: unknown) {
  if (!Array.isArray(rawMemories)) return [];
  return rawMemories
    .map((item) => {
      if (typeof item === 'string') {
        return { text: String(item || '').trim(), source: 'sync' };
      }
      const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        id: String(entry.id || '').trim() || undefined,
        text: String(entry.text || '').trim(),
        source: String(entry.source || 'sync').trim(),
        createdAt: String(entry.createdAt || '').trim() || undefined
      };
    })
    .filter((item) => item.text)
    .slice(-24);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return jsonResponse({ ok: false, error: 'Usuario nao autenticado.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'chat').trim().toLowerCase() || 'chat';
    const supabaseAdmin = createSupabaseAdminClient();

    if (action === 'state') {
      const state = await loadSextaAgentState(supabaseAdmin, user.id);
      return jsonResponse({ ok: true, state });
    }

    if (action === 'save_profile') {
      const profile = await saveSextaProfile(
        supabaseAdmin,
        user.id,
        normalizeSextaProfile(body?.profile || {})
      );
      const state = await loadSextaAgentState(supabaseAdmin, user.id);
      return jsonResponse({ ok: true, profile, state });
    }

    if (action === 'save_memory') {
      const memory = await saveSextaMemory(
        supabaseAdmin,
        user.id,
        String(body?.text || '').trim(),
        String(body?.source || 'manual').trim() || 'manual'
      );
      const state = await loadSextaAgentState(supabaseAdmin, user.id);
      return jsonResponse({ ok: true, memory, state });
    }

    if (action === 'remove_memory') {
      const removed = await removeSextaMemory(
        supabaseAdmin,
        user.id,
        String(body?.query || '').trim()
      );
      const state = await loadSextaAgentState(supabaseAdmin, user.id);
      return jsonResponse({ ok: true, removed, state });
    }

    if (action === 'clear_memory') {
      await clearSextaMemories(supabaseAdmin, user.id);
      const state = await loadSextaAgentState(supabaseAdmin, user.id);
      return jsonResponse({ ok: true, cleared: true, state });
    }

    const prompt = String(body?.prompt || '').trim();
    if (!prompt) {
      return jsonResponse({ ok: false, error: 'Prompt obrigatorio.' }, 400);
    }

    const profile = normalizeSextaProfile(body?.profile || {});
    const memories = normalizeMemories(body?.memories);
    const contextSummary = await buildSextaContextSummary(supabaseAdmin, user.id, profile, memories);
    const agentResult = await runSextaAgentLoop({
      supabaseAdmin,
      userId: user.id,
      prompt,
      channel: 'app',
      history: normalizeHistory(body?.history),
      systemPrompt: String(body?.systemPrompt || '').trim(),
      model: String(body?.model || '').trim() || 'manifest/auto',
      profile,
      memories,
      contextSummary
    });

    return jsonResponse({
      ok: true,
      reply: agentResult.reply,
      provider: 'manifest',
      model: String(body?.model || '').trim() || 'manifest/auto',
      state: agentResult.state,
      reflection: agentResult.reflection || null,
      toolResults: agentResult.toolResults
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    );
  }
});
