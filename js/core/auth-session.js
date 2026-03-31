(function () {
  function setAuthModalVisible(visible) {
    const authModal = document.getElementById('authModal');
    if (!authModal) return;
    authModal.classList.toggle('show', visible);
    authModal.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function setUserEmail(user) {
    const userEmailEl = document.getElementById('userEmail');
    if (!userEmailEl) return;
    userEmailEl.textContent = user && user.email ? user.email : 'user@email.com';
  }

  function createFlowlyAuthSession(deps) {
    const supabaseClient = deps.supabaseClient;
    const debugLog = deps.debugLog || function () {};
    const setCurrentUser = deps.setCurrentUser;
    const getCurrentUser = deps.getCurrentUser;
    const onSessionDataRequired = deps.onSessionDataRequired || async function () {};
    const onSignedOut =
      deps.onSignedOut ||
      function () {
        location.reload();
      };
    const migrateLocalDataToSupabase = deps.migrateLocalDataToSupabase || async function () {};

    let initialFetchDone = false;
    let signOutInProgress = false;

    async function applyAuthenticatedSession(user, options) {
      setCurrentUser(user);
      setAuthModalVisible(false);
      setUserEmail(user);

      const shouldLoad =
        options && options.forceLoad
          ? true
          : options && options.loadWhenEmpty
            ? options.isDataEmpty()
            : false;

      if (shouldLoad) {
        await onSessionDataRequired();
      }
    }

    async function bootstrapInitialSession() {
      const result = await supabaseClient.auth.getSession();
      const session = result && result.data ? result.data.session : null;
      if (!session || initialFetchDone) return;

      initialFetchDone = true;
      await applyAuthenticatedSession(session.user, {
        forceLoad: true,
        isDataEmpty: function () {
          return true;
        }
      });
    }

    function initAuthStateListener(isDataEmpty) {
      supabaseClient.auth.onAuthStateChange(async function (event, session) {
        debugLog('Auth state changed:', event, session ? 'user active' : 'no session');

        if (event === 'INITIAL_SESSION') {
          if (session && !initialFetchDone) {
            initialFetchDone = true;
            await applyAuthenticatedSession(session.user, {
              forceLoad: true,
              isDataEmpty: isDataEmpty
            });
          } else if (!session) {
            setAuthModalVisible(true);
          }
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          signOutInProgress = false;
          await applyAuthenticatedSession(session.user, {
            forceLoad: false,
            loadWhenEmpty: true,
            isDataEmpty: isDataEmpty
          });
          return;
        }

        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setAuthModalVisible(true);
          if (signOutInProgress) {
            signOutInProgress = false;
          }
          onSignedOut();
        }
      });
    }

    function init(isDataEmpty) {
      document.addEventListener('DOMContentLoaded', function () {
        bootstrapInitialSession();
      });
      initAuthStateListener(isDataEmpty);
    }

    async function checkAuth() {
      debugLog('[Auth] Checking auth...');
      const result = await supabaseClient.auth.getSession();
      const session = result && result.data ? result.data.session : null;
      const error = result ? result.error : null;
      debugLog('[Auth] Session:', session ? 'found' : 'not found', error);

      if (session) {
        debugLog('[Auth] User logged in:', session.user.email);
        await applyAuthenticatedSession(session.user, {
          forceLoad: true,
          isDataEmpty: function () {
            return true;
          }
        });
        return true;
      }

      debugLog('[Auth] No session, showing login');
      setAuthModalVisible(true);
      return false;
    }

    async function signIn(email, password, isDataEmpty) {
      const keepEl = document.getElementById('keepLoggedIn');
      const keepLoggedIn = keepEl ? keepEl.checked : true;
      localStorage.setItem('flowly_persist_session', keepLoggedIn.toString());

      const result = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });
      const data = result ? result.data : null;
      const error = result ? result.error : null;

      if (error) return { ok: false, error: error.message };

      await applyAuthenticatedSession(data.user, {
        forceLoad: false,
        loadWhenEmpty: false,
        isDataEmpty: isDataEmpty
      });

      await migrateLocalDataToSupabase();
      await onSessionDataRequired();
      return { ok: true };
    }

    async function signUp(email, password, isDataEmpty) {
      const result = await supabaseClient.auth.signUp({ email: email, password: password });
      const error = result ? result.error : null;
      if (error) return { ok: false, error: error.message };

      const signInResult = await signIn(email, password, isDataEmpty);
      if (!signInResult.ok) return signInResult;
      return { ok: true };
    }

    async function signOut() {
      signOutInProgress = true;
      const result = await supabaseClient.auth.signOut();
      if (result && result.error) {
        signOutInProgress = false;
        throw result.error;
      }
    }

    return {
      init: init,
      checkAuth: checkAuth,
      signIn: signIn,
      signUp: signUp,
      signOut: signOut,
      getCurrentUser: getCurrentUser
    };
  }

  window.FlowlyAuthSession = {
    create: createFlowlyAuthSession
  };
})();
