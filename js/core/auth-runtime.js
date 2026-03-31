async function checkAuth() {
  if (!authSession) return false;
  return authSession.checkAuth();
}

async function signUp(email, password) {
  if (!authSession) return false;
  const result = await authSession.signUp(
    email,
    password,
    () => !allTasksData || Object.keys(allTasksData).length === 0
  );
  if (!result.ok) {
    if (typeof window.showAuthMessage === 'function') {
      window.showAuthMessage(result.error);
    }
    return false;
  }

  if (typeof window.showAuthMessage === 'function') {
    window.showAuthMessage('Conta criada! Fazendo login...', 'success');
  }
  return true;
}

async function signIn(email, password) {
  if (!authSession) return false;
  const result = await authSession.signIn(
    email,
    password,
    () => !allTasksData || Object.keys(allTasksData).length === 0
  );
  if (!result.ok) {
    if (typeof window.showAuthMessage === 'function') {
      window.showAuthMessage(result.error);
    }
    return false;
  }
  return true;
}

async function signOut() {
  if (!authSession) return;
  await authSession.signOut();
}

async function migrateLocalDataToSupabase() {
  if (!tasksRepo) return;
  await tasksRepo.migrateLocalDataToSupabase();
}

async function loadDataFromSupabase() {
  if (!tasksRepo) return;
  await tasksRepo.loadDataFromSupabase();
  await loadFinanceStateFromSupabase();
  await loadProjectsStateFromSupabase();
}

async function syncDailyRoutineToSupabase() {
  // Deprecated or legacy handled silently.
}

function initAuthRuntime() {
  const flowlyAuthSessionFactory = window.FlowlyAuthSession;
  if (!flowlyAuthSessionFactory) return;

  authSession = flowlyAuthSessionFactory.create({
    supabaseClient,
    debugLog,
    setCurrentUser: (user) => {
      currentUser = user;
    },
    getCurrentUser: () => currentUser,
    onSessionDataRequired: async () => {
      if (typeof flushPendingTaskDeletesToSupabase === 'function') {
        await flushPendingTaskDeletesToSupabase();
      }
      await loadDataFromSupabase();
      await syncUnsyncedTasksToSupabase();
      renderView();
    },
    onSignedOut: () => {
      location.reload();
    },
    migrateLocalDataToSupabase
  });

  authSession.init(() => !allTasksData || Object.keys(allTasksData).length === 0);
}

window.checkAuth = checkAuth;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.migrateLocalDataToSupabase = migrateLocalDataToSupabase;
window.loadDataFromSupabase = loadDataFromSupabase;
window.syncDailyRoutineToSupabase = syncDailyRoutineToSupabase;
window.initAuthRuntime = initAuthRuntime;
