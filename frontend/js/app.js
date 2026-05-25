(function () {
  'use strict';

  function listen(id, event, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  var API_BASE = '/api';
  var MAX_QUESTIONS = 5;

  var state = {
    token: null,
    user: null,
    areaId: null,
    areaName: '',
    difficultyLevel: 'mid',
    mode: 'chat',
    interviewId: null,
    currentQuestion: null,
    questionNumber: 0,
    questionsAndAnswers: [],
    isProcessing: false,
    lastModel: null,
    historyPage: 1,
    historyFilters: { search: '', areaId: '', difficulty: '', scoreMin: '', scoreMax: '' }
  };

  var landingView = document.getElementById('view-landing');

  var authViews = {
    login: document.getElementById('view-login'),
    register: document.getElementById('view-register')
  };

  var appMain = document.getElementById('app-main');

  var appViews = {
    home: document.getElementById('view-home'),
    areas: document.getElementById('view-areas'),
    chat: document.getElementById('view-chat'),
    evaluation: document.getElementById('view-evaluation'),
    history: document.getElementById('view-history'),
    session: document.getElementById('view-session-detail'),
    profile: document.getElementById('view-profile'),
    quiz: document.getElementById('view-quiz'),
    quizResults: document.getElementById('view-quiz-results')
  };

  var loadingOverlay = document.getElementById('loading-overlay');
  var loadingText = document.getElementById('loading-text');

  // ─── Auth view sections (must be defined before showAuthView) ──

  function showLoginSection() {
    var loginSec = document.getElementById('login-form-section');
    var forgotSec = document.getElementById('forgot-form-section');
    var resetSec = document.getElementById('reset-form-section');
    if (loginSec) loginSec.classList.remove('view-hidden');
    if (forgotSec) forgotSec.classList.add('view-hidden');
    if (resetSec) resetSec.classList.add('view-hidden');
  }

  function showForgotSection() {
    var loginSec = document.getElementById('login-form-section');
    var forgotSec = document.getElementById('forgot-form-section');
    var resetSec = document.getElementById('reset-form-section');
    if (loginSec) loginSec.classList.add('view-hidden');
    if (forgotSec) forgotSec.classList.remove('view-hidden');
    if (resetSec) resetSec.classList.add('view-hidden');
    var err = document.getElementById('forgot-error');
    var suc = document.getElementById('forgot-success');
    if (err) err.classList.add('view-hidden');
    if (suc) suc.classList.add('hidden');
    var emailInput = document.getElementById('forgot-email');
    if (emailInput) emailInput.value = '';
  }

  function showResetSection() {
    var loginSec = document.getElementById('login-form-section');
    var forgotSec = document.getElementById('forgot-form-section');
    var resetSec = document.getElementById('reset-form-section');
    if (loginSec) loginSec.classList.add('view-hidden');
    if (forgotSec) forgotSec.classList.add('view-hidden');
    if (resetSec) resetSec.classList.remove('view-hidden');
    var err = document.getElementById('reset-error');
    var suc = document.getElementById('reset-success');
    if (err) err.classList.add('view-hidden');
    if (suc) suc.classList.add('hidden');
  }

  function showLoading(text) {
    loadingText.textContent = text || 'Cargando...';
    loadingOverlay.classList.remove('view-hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('view-hidden');
  }

  function showLanding() {
    if (landingView) {
      Object.keys(authViews).forEach(function (key) {
        authViews[key].classList.remove('view-active');
        authViews[key].classList.add('view-hidden');
      });
      appMain.classList.add('view-hidden');
      landingView.classList.remove('view-hidden');
      landingView.classList.add('view-active');
    }
  }

  function showAppView(viewName) {
    Object.keys(appViews).forEach(function (key) {
      if (appViews[key]) {
        appViews[key].classList.remove('view-active');
        appViews[key].classList.add('view-hidden');
      }
    });
    if (appViews[viewName]) {
      appViews[viewName].classList.remove('view-hidden');
      appViews[viewName].classList.add('view-active');
    }
  }

  function showAuthView(viewName) {
    if (landingView) {
      landingView.classList.remove('view-active');
      landingView.classList.add('view-hidden');
    }
    Object.keys(authViews).forEach(function (key) {
      authViews[key].classList.remove('view-active');
      authViews[key].classList.add('view-hidden');
    });
    appMain.classList.add('view-hidden');
    if (authViews[viewName]) {
      authViews[viewName].classList.remove('view-hidden');
      authViews[viewName].classList.add('view-active');
    }
    if (viewName === 'login') {
      showLoginSection();
    }
  }

  function showApp() {
    if (landingView) {
      landingView.classList.remove('view-active');
      landingView.classList.add('view-hidden');
    }
    Object.keys(authViews).forEach(function (key) {
      authViews[key].classList.remove('view-active');
      authViews[key].classList.add('view-hidden');
    });
    appMain.classList.remove('view-hidden');
    appMain.classList.add('view-active');
    showAppView('home');
    loadDashboardStats();
  }

  async function apiRequest(endpoint, method, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (state.token) {
      headers['Authorization'] = 'Bearer ' + state.token;
    }
    var options = {
      method: method || 'GET',
      headers: headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    var response = await fetch(API_BASE + endpoint, options);
    var data;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('Error de conexion con el servidor');
    }
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error en la solicitud');
    }
    return data.data;
  }

  // ─── URL params detection for password reset ─────────

  function checkResetToken() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');
    if (token) {
      showAuthView('login');
      showResetSection();
      document.getElementById('reset-token').value = token;
    }
  }

  // ─── AUTH: Session check on load ─────────────────────

  var savedToken = localStorage.getItem('token');
  if (savedToken) {
    state.token = savedToken;
    verifySession();
  } else {
    showLanding();
    checkResetToken();
  }

  async function verifySession() {
    try {
      var data = await apiRequest('/auth/me');
      state.user = data.user;
      document.getElementById('nav-user-name').textContent = state.user.fullName;
      document.getElementById('mobile-user-name').textContent = state.user.fullName;
      state.difficultyLevel = state.user.techLevel || 'mid';
      fillDropdown(state.user);
      showApp();
    } catch (e) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('token');
      showAuthView('login');
    }
  }

  // ─── AUTH: Login ─────────────────────────────────────

  listen('form-login', 'submit', async function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('login-error');
    errorEl.classList.add('view-hidden');

    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;

    if (!email || !password) {
      errorEl.textContent = 'Completa todos los campos.';
      errorEl.classList.remove('view-hidden');
      return;
    }

    try {
      showLoading('Iniciando sesion...');
      var data = await apiRequest('/auth/login', 'POST', { email: email, password: password });
      state.token = data.token;
      state.user = data.user;
      state.difficultyLevel = data.user.techLevel || 'mid';
      localStorage.setItem('token', data.token);
      document.getElementById('nav-user-name').textContent = data.user.fullName;
      document.getElementById('mobile-user-name').textContent = data.user.fullName;
      fillDropdown(data.user);
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
      showApp();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('view-hidden');
    } finally {
      hideLoading();
    }
  });

  // ─── AUTH: Register ──────────────────────────────────

  listen('form-register', 'submit', async function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('register-error');
    errorEl.classList.add('view-hidden');

    var fullName = document.getElementById('reg-name').value.trim();
    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;

    if (!fullName || !email || !password) {
      errorEl.textContent = 'Completa todos los campos.';
      errorEl.classList.remove('view-hidden');
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'La password debe tener al menos 6 caracteres.';
      errorEl.classList.remove('view-hidden');
      return;
    }

    try {
      showLoading('Creando cuenta...');
      var data = await apiRequest('/auth/register', 'POST', {
        fullName: fullName,
        email: email,
        password: password
      });
      state.token = data.token;
      state.user = data.user;
      state.difficultyLevel = data.user.techLevel || 'mid';
      localStorage.setItem('token', data.token);
      document.getElementById('nav-user-name').textContent = data.user.fullName;
      document.getElementById('mobile-user-name').textContent = data.user.fullName;
      fillDropdown(data.user);
      document.getElementById('reg-name').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      showApp();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('view-hidden');
    } finally {
      hideLoading();
    }
  });

  // ─── AUTH: Logout ────────────────────────────────────

  function doLogout() {
    apiRequest('/auth/logout', 'POST').catch(function () {});
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    hideDropdown();
    showAuthView('login');
  }

  document.querySelectorAll('#btn-logout').forEach(function (el) {
    el.addEventListener('click', doLogout);
  });

  // ─── Profile Dropdown ────────────────────────────────

  function fillDropdown(user) {
    var nameEl = document.getElementById('dropdown-user-name');
    var emailEl = document.getElementById('dropdown-user-email');
    if (nameEl) nameEl.textContent = user.fullName;
    if (emailEl) emailEl.textContent = user.email;
  }

  listen('avatar-trigger', 'click', function (e) {
    e.stopPropagation();
    var dd = document.getElementById('profile-dropdown');
    dd.classList.toggle('hidden');
  });

  function hideDropdown() {
    document.getElementById('profile-dropdown').classList.add('hidden');
  }

  document.addEventListener('click', function (e) {
    var dd = document.getElementById('profile-dropdown');
    var trigger = document.getElementById('avatar-trigger');
    if (!dd.classList.contains('hidden') && !dd.contains(e.target) && !trigger.contains(e.target)) {
      dd.classList.add('hidden');
    }
  });

  listen('btn-go-profile', 'click', function () {
    hideDropdown();
    loadProfile();
    showAppView('profile');
  });

  // ─── Mobile Navigation ────────────────────────────

  function openMobileNav() {
    document.getElementById('mobile-nav-overlay').classList.add('open');
    document.getElementById('mobile-nav-panel').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileNav() {
    document.getElementById('mobile-nav-overlay').classList.remove('open');
    document.getElementById('mobile-nav-panel').classList.remove('open');
    document.body.style.overflow = '';
  }

  listen('btn-mobile-nav', 'click', openMobileNav);
  listen('btn-mobile-nav-close', 'click', closeMobileNav);
  listen('mobile-nav-overlay', 'click', closeMobileNav);

  document.querySelectorAll('.mobile-nav-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeMobileNav();
      var view = this.getAttribute('data-view');
      if (view === 'history') {
        state.historyPage = 1;
        loadHistory();
      } else if (view === 'areas') {
        loadAreas();
      } else if (view === 'profile') {
        loadProfile();
      }
      if (view) showAppView(view);
    });
  });

  listen('btn-mobile-logout', 'click', function () {
    closeMobileNav();
    doLogout();
  });

  // Close mobile nav on escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeMobileNav();
    }
  });

  // Close mobile nav on resize to desktop
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 641) {
      closeMobileNav();
    }
  });

  // ─── Profile View ────────────────────────────────────

  async function loadProfile() {
    try {
      showLoading('Cargando perfil...');
      var [profile, stats] = await Promise.all([
        apiRequest('/user/profile'),
        apiRequest('/dashboard/stats').catch(function () { return null; })
      ]);

      document.getElementById('pf-name').value = profile.fullName || '';
      document.getElementById('pf-email').value = profile.email || '';
      document.getElementById('pf-bio').value = profile.bio || '';
      document.getElementById('pf-level').value = profile.techLevel || 'mid';
      document.getElementById('profile-saved-msg').classList.add('hidden');

      document.getElementById('password-saved-msg').classList.add('hidden');
      document.getElementById('password-error-msg').classList.add('hidden');

      if (stats) {
        document.getElementById('pstat-total').textContent = stats.totalInterviews;
        document.getElementById('pstat-avg').textContent = stats.avgScore;
        document.getElementById('pstat-streak').textContent = stats.currentStreak + ' dias';
        document.getElementById('pstat-weekly').textContent = stats.weeklyProgress + '/' + (stats.weeklyTarget || 5);
      }
    } catch (error) {
      showToast('Error al cargar perfil: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  listen('btn-save-profile', 'click', async function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    try {
      await apiRequest('/user/profile', 'PUT', {
        fullName: document.getElementById('pf-name').value.trim(),
        bio: document.getElementById('pf-bio').value.trim(),
        techLevel: document.getElementById('pf-level').value
      });
      state.user.fullName = document.getElementById('pf-name').value.trim();
      document.getElementById('nav-user-name').textContent = state.user.fullName;
      document.getElementById('mobile-user-name').textContent = state.user.fullName;
      fillDropdown(state.user);
      document.getElementById('profile-saved-msg').classList.remove('hidden');
    } catch (error) {
      showToast('Error: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  });

  listen('btn-save-password', 'click', async function () {
    var btn = this;
    var current = document.getElementById('pf-current-pwd').value;
    var newPwd = document.getElementById('pf-new-pwd').value;
    var confirm = document.getElementById('pf-confirm-pwd').value;

    document.getElementById('password-saved-msg').classList.add('hidden');
    document.getElementById('password-error-msg').classList.add('hidden');

    if (!current || !newPwd || !confirm) {
      document.getElementById('password-error-msg').textContent = 'Completa todos los campos.';
      document.getElementById('password-error-msg').classList.remove('hidden');
      return;
    }
    if (newPwd.length < 6) {
      document.getElementById('password-error-msg').textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
      document.getElementById('password-error-msg').classList.remove('hidden');
      return;
    }
    if (newPwd !== confirm) {
      document.getElementById('password-error-msg').textContent = 'Las contraseñas no coinciden.';
      document.getElementById('password-error-msg').classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Actualizando...';
    try {
      await apiRequest('/user/password', 'PUT', {
        currentPassword: current,
        newPassword: newPwd
      });
      document.getElementById('pf-current-pwd').value = '';
      document.getElementById('pf-new-pwd').value = '';
      document.getElementById('pf-confirm-pwd').value = '';
      document.getElementById('password-saved-msg').classList.remove('hidden');
    } catch (error) {
      document.getElementById('password-error-msg').textContent = error.message;
      document.getElementById('password-error-msg').classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Actualizar contraseña';
    }
  });

  // ─── AUTH: Switch views ──────────────────────────────

  listen('link-to-register', 'click', function (e) {
    e.preventDefault();
    showAuthView('register');
  });

  listen('link-to-login', 'click', function (e) {
    e.preventDefault();
    showAuthView('login');
  });

  // ─── Forgot Password ────────────────────────────────

  listen('link-forgot-password', 'click', function (e) {
    e.preventDefault();
    showForgotSection();
  });

  listen('link-back-to-login-from-forgot', 'click', function (e) {
    e.preventDefault();
    showLoginSection();
  });

  listen('link-back-to-login-from-reset', 'click', function (e) {
    e.preventDefault();
    showLoginSection();
  });

  listen('form-forgot', 'submit', async function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('forgot-error');
    var successEl = document.getElementById('forgot-success');
    errorEl.classList.add('view-hidden');
    successEl.classList.add('hidden');

    var email = document.getElementById('forgot-email').value.trim();
    if (!email) {
      errorEl.textContent = 'Ingresa tu correo electrónico.';
      errorEl.classList.remove('view-hidden');
      return;
    }

    try {
      showLoading('Enviando enlace...');
      var data = await apiRequest('/auth/forgot-password', 'POST', { email: email });
      document.getElementById('forgot-success-text').textContent = data.message || 'Revisa tu correo para continuar.';
      successEl.classList.remove('hidden');
      document.getElementById('forgot-email').value = '';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('view-hidden');
    } finally {
      hideLoading();
    }
  });

  listen('form-reset', 'submit', async function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('reset-error');
    var successEl = document.getElementById('reset-success');
    errorEl.classList.add('view-hidden');
    successEl.classList.add('hidden');

    var token = document.getElementById('reset-token').value.trim();
    var newPwd = document.getElementById('reset-new-password').value;

    if (!token || !newPwd) {
      errorEl.textContent = 'Completa todos los campos.';
      errorEl.classList.remove('view-hidden');
      return;
    }
    if (newPwd.length < 6) {
      errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      errorEl.classList.remove('view-hidden');
      return;
    }

    try {
      showLoading('Restableciendo contraseña...');
      await apiRequest('/auth/reset-password', 'POST', { token: token, newPassword: newPwd });
      successEl.classList.remove('hidden');
      document.getElementById('reset-token').value = '';
      document.getElementById('reset-new-password').value = '';
      setTimeout(function () { showLoginSection(); }, 3000);
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('view-hidden');
    } finally {
      hideLoading();
    }
  });

  // ─── Home ───────────────────────────────────────────

  listen('btn-start', 'click', function () {
    loadAreas();
    showAppView('areas');
  });

  listen('btn-start-home', 'click', function () {
    loadAreas();
    showAppView('areas');
  });

  listen('btn-history-nav', 'click', function () {
    state.historyPage = 1;
    loadHistory();
    showAppView('history');
  });

  listen('btn-history-home', 'click', function () {
    state.historyPage = 1;
    loadHistory();
    showAppView('history');
  });

  // ─── Dashboard Stats ────────────────────────────────

  async function loadDashboardStats() {
    try {
      var stats = await apiRequest('/dashboard/stats');
      document.getElementById('stat-total').textContent = stats.totalInterviews;
      document.getElementById('stat-quizzes').textContent = stats.completedQuizzes || 0;
      document.getElementById('stat-avg').textContent = stats.avgScore;
      document.getElementById('stat-streak').textContent = stats.currentStreak + ' dias';
      if (stats.weeklyTarget) {
        document.getElementById('stat-weekly').textContent = stats.weeklyProgress + '/' + stats.weeklyTarget;
      }
    } catch (e) {}
  }

  // ─── Areas ──────────────────────────────────────────

  async function loadAreas() {
    try {
      showLoading('Cargando areas...');
      var areas = await apiRequest('/areas');
      renderAreas(areas);
      initModeSelector();
      window.setDifficultyJS(state.difficultyLevel);
    } catch (error) {
      showToast('Error al cargar areas: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  function renderAreas(areas) {
    var grid = document.getElementById('areas-grid');
    grid.innerHTML = '';
    areas.forEach(function (area) {
      var card = document.createElement('div');
      card.className = 'bg-surface-container-low border border-outline-variant rounded-xl p-[24px] flex flex-col gap-[16px] hover:border-primary transition-all duration-300';
      card.style.backgroundColor = '#20242D';

      var selectedDiff = state.difficultyLevel || 'mid';

      var popularBadge = area.popular
        ? '<span class="badge-popular">Popular</span>'
        : '';

      var iconHtml = area.icon
        ? '<span class="material-symbols-outlined" style="font-size:32px;color:#5B7CFA">' + escapeHTML(area.icon) + '</span>'
        : '<span class="material-symbols-outlined" style="font-size:32px;color:#5B7CFA">code</span>';

      card.innerHTML =
        '<div class="flex-between" style="align-items:flex-start">' +
          '<div class="icon-container">' + iconHtml + '</div>' +
          popularBadge +
        '</div>' +
        '<div>' +
          '<h3 class="font-h3 text-h3 text-on-surface" style="margin:0;font-size:20px;font-weight:500;color:#E6E8EE">' + escapeHTML(area.name) + '</h3>' +
          '<p class="font-body-sm text-body-sm" style="margin:4px 0 0;font-size:14px;color:#A7ADB8;line-height:1.5">' + escapeHTML(area.description) + '</p>' +
        '</div>' +
        '<div style="margin-top:auto">' +
          '<div style="margin-bottom:8px">' +
            '<span class="font-label-uppercase" style="font-size:11px;font-family:JetBrains Mono;color:#7D8593;text-transform:uppercase;letter-spacing:0.05em">Dificultad</span>' +
          '</div>' +
          '<div class="diff-btn-group">' +
            '<button class="diff-btn' + (selectedDiff === 'junior' ? ' diff-btn--active' : '') + '" data-area="' + area.id + '" data-level="junior">Junior</button>' +
            '<button class="diff-btn' + (selectedDiff === 'mid' ? ' diff-btn--active' : '') + '" data-area="' + area.id + '" data-level="mid">Mid</button>' +
            '<button class="diff-btn' + (selectedDiff === 'senior' ? ' diff-btn--active' : '') + '" data-area="' + area.id + '" data-level="senior">Senior</button>' +
          '</div>' +
          '<button class="start-interview-btn btn-primary btn-primary--full" data-area-id="' + area.id + '" data-area-name="' + escapeHTML(area.name) + '">Iniciar Entrevista</button>' +
        '</div>';

      grid.appendChild(card);
    });

    // Event delegation: diff buttons
    document.querySelectorAll('.diff-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var areaId = this.getAttribute('data-area');
        var level = this.getAttribute('data-level');
        document.querySelectorAll('.diff-btn[data-area="' + areaId + '"]').forEach(function (b) {
          var isActive = b.getAttribute('data-level') === level;
          b.classList.toggle('diff-btn--active', isActive);
        });
        state.difficultyLevel = level;
      });
    });

    // Event delegation: start buttons
    document.querySelectorAll('.start-interview-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var areaId = parseInt(this.getAttribute('data-area-id'), 10);
        var areaName = this.getAttribute('data-area-name');
        if (state.mode === 'quiz') {
          startQuizDirect(areaId, areaName);
        } else {
          startInterview(areaId, areaName);
        }
      });
    });
  }

  // ─── Mode Selector ──────────────────────────────────
  function initModeSelector() {
    var chatBtn = document.getElementById('mode-btn-chat');
    var quizBtn = document.getElementById('mode-btn-quiz');
    var descEl = document.getElementById('mode-description-text');

    function setMode(mode) {
      state.mode = mode;
      var isChat = mode === 'chat';
      chatBtn.classList.toggle('btn-primary', isChat);
      chatBtn.classList.toggle('btn-secondary', !isChat);
      quizBtn.classList.toggle('btn-primary', !isChat);
      quizBtn.classList.toggle('btn-secondary', isChat);
      descEl.textContent = isChat
        ? 'Practica con IA generativa. Recibe feedback en cada respuesta.'
        : 'Cuestionario de opcion multiple. Evaluacion automatica al finalizar.';
      document.querySelectorAll('.start-interview-btn').forEach(function (b) {
        b.textContent = mode === 'quiz' ? 'Iniciar Cuestionario' : 'Iniciar Entrevista';
      });
    }

    if (chatBtn && quizBtn) {
      chatBtn.addEventListener('click', function () { setMode('chat'); });
      quizBtn.addEventListener('click', function () { setMode('quiz'); });
      setMode(state.mode || 'chat');
    }
  }

  // ─── Quiz Direct Mode ─────────────────────────────

  async function startQuizDirect(areaId, areaName) {
    try {
      showLoading('Preparando cuestionario...');
      state.areaId = areaId;
      state.areaName = areaName;

      var data = await apiRequest('/quiz/start', 'POST', {
        areaId: areaId,
        difficulty: state.difficultyLevel,
        limit: 5
      });

      startQuiz({
        interviewId: data.interviewId,
        area: data.area,
        difficulty: data.difficulty,
        totalQuestions: data.totalQuestions,
        questions: data.questions
      });
    } catch (error) {
      showToast('Error: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  // ─── Interview Flow ─────────────────────────────────

  function showTokenBanner(rateLimited) {
    var banner = document.getElementById('chat-token-banner');
    if (!banner) return;
    if (rateLimited) {
      banner.classList.remove('hidden');
      banner.style.display = 'flex';
    } else {
      banner.classList.add('hidden');
      banner.style.display = '';
    }
  }

  async function startInterview(areaId, areaName) {
    try {
      showLoading('Preparando entrevista...');
      state.areaId = areaId;
      state.areaName = areaName;

      var result = await apiRequest('/interview/start', 'POST', {
        areaId: areaId,
        difficultyLevel: state.difficultyLevel,
        mode: 'chat'
      });

      if (result.quizMode) {
        startQuiz(result.quiz);
        return;
      }

      state.interviewId = result.interviewId;

      showTokenBanner(result.rateLimited);

      state.lastModel = result.model || 'Nemotron Nano';

      if (result.resumed) {
        state.currentQuestion = result.currentQuestion;
        state.questionNumber = result.questionNumber;
        state.questionsAndAnswers = result.questionsAndAnswers || [];
        showAppView('chat');
        setupChatUI();
        result.questionsAndAnswers.forEach(function (qa) {
          addSystemMessage(qa.question);
          addUserMessage(qa.answer);
        });
        addSystemMessage(result.currentQuestion.text);
        updateQuestionCounter();
      } else {
        state.currentQuestion = result.question;
        state.questionNumber = 1;
        state.questionsAndAnswers = [];
        showAppView('chat');
        setupChatUI();
        addSystemMessage(result.question.text);
        updateQuestionCounter();
      }
      updateModelBadge(state.lastModel);
    } catch (error) {
      showToast('Error al iniciar entrevista: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  function setupChatUI() {
    var messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = '';
    document.getElementById('chat-area-name').textContent = state.areaName + ' [' + difficultyLabel(state.difficultyLevel) + ']';
    updateQuestionCounter();
    updateModelBadge(state.lastModel || 'Nemotron Nano');
  }

  function updateModelBadge(model) {
    var badge = document.getElementById('chat-model-badge');
    if (!badge) return;
    if (model === 'Banco local') {
      badge.textContent = 'Banco local';
      badge.style.background = 'rgba(214,165,74,0.12)';
      badge.style.borderColor = 'rgba(214,165,74,0.3)';
      badge.style.color = '#D6A54A';
      badge.style.display = 'inline';
    } else {
      badge.textContent = model;
      badge.style.background = 'rgba(76,110,245,0.1)';
      badge.style.borderColor = 'rgba(76,110,245,0.25)';
      badge.style.color = '#4C6EF5';
      badge.style.display = 'inline';
    }
  }

  function difficultyLabel(level) {
    return level === 'junior' ? 'Junior' : level === 'senior' ? 'Senior' : 'Mid';
  }

  function updateQuestionCounter() {
    document.getElementById('chat-question-counter').textContent =
      'Pregunta ' + state.questionNumber + ' de ' + MAX_QUESTIONS;
    var progress = document.getElementById('chat-progress-bar');
    if (progress) {
      progress.style.width = Math.min(100, (state.questionNumber / MAX_QUESTIONS) * 100) + '%';
    }
  }

  function addSystemMessage(text) {
    var msg = document.createElement('div');
    msg.className = 'message system';
    msg.innerHTML = '<p>' + escapeHTML(text).replace(/\n/g, '<br>') + '</p>';
    document.getElementById('chat-messages').appendChild(msg);
    scrollToBottom();
  }

  function addUserMessage(text) {
    var msg = document.createElement('div');
    msg.className = 'message user';
    msg.innerHTML = '<p>' + escapeHTML(text).replace(/\n/g, '<br>') + '</p>';
    document.getElementById('chat-messages').appendChild(msg);
    scrollToBottom();
  }

  function addFeedbackMessage(feedback, score) {
    if (!feedback) return;
    var msg = document.createElement('div');
    msg.className = 'message feedback';
    var scoreColor = score >= 70 ? '#4CAF7A' : score >= 40 ? '#D6A54A' : '#D96B6B';
    msg.innerHTML =
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:' + scoreColor + ';margin-bottom:4px;font-family:JetBrains Mono">Feedback IA — <strong>' + score + '/100</strong></div>' +
      '<p style="font-size:13px;color:#7D8593">' + escapeHTML(feedback) + '</p>';
    msg.className = 'message-feedback';
    msg.style.borderLeft = '3px solid ' + scoreColor;
    document.getElementById('chat-messages').appendChild(msg);
    scrollToBottom();
  }

  function scrollToBottom() {
    var messagesDiv = document.getElementById('chat-messages');
    setTimeout(function () {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
  }

  listen('btn-send', 'click', submitAnswerHandler);
  listen('chat-input', 'keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitAnswerHandler();
    }
  });

  async function submitAnswerHandler() {
    if (state.isProcessing) return;
    var input = document.getElementById('chat-input');
    var answer = input.value.trim();
    if (!answer) return;

    input.value = '';
    state.isProcessing = true;
    document.getElementById('btn-send').disabled = true;

    addUserMessage(answer);

    state.questionsAndAnswers.push({
      question: state.currentQuestion.text,
      answer: answer
    });

    try {
      showLoading(state.questionNumber >= MAX_QUESTIONS ? 'Generando evaluacion final...' : 'Evaluando respuesta...');
      var result = await apiRequest('/interview/answer', 'POST', {
        interviewId: state.interviewId,
        questionId: state.currentQuestion.id,
        answer: answer,
        questionNumber: state.questionNumber,
        areaName: state.areaName,
        difficulty: state.difficultyLevel,
        previousAnswer: state.questionsAndAnswers.length > 1 ? state.questionsAndAnswers[state.questionsAndAnswers.length - 2].answer : ''
      });

      if (result.lastFeedback) {
        addFeedbackMessage(result.lastFeedback.feedback, result.lastFeedback.score);
      }

      if (result.finished) {
        showLoading('Generando evaluacion final...');
        var evaluation = await apiRequest('/interview/finish', 'POST', {
          interviewId: state.interviewId,
          areaId: state.areaId
        });
        showEvaluation(evaluation);
      } else {
        state.currentQuestion = result.question;
        state.questionNumber = result.question.order;
        if (result.model) {
          state.lastModel = result.model;
          updateModelBadge(result.model);
        }
        addSystemMessage(result.question.text);
        updateQuestionCounter();
      }
    } catch (error) {
      addSystemMessage('Error: ' + error.message + '. Intenta de nuevo.');
    } finally {
      hideLoading();
      state.isProcessing = false;
      document.getElementById('btn-send').disabled = false;
      document.getElementById('chat-input').focus();
    }
  }

  // ─── Quiz ───────────────────────────────────────────

  var quizState = { questions: [], currentIndex: 0, answers: {}, area: '', difficulty: '', interviewId: null, timerInterval: null, startTime: null };

  function startQuiz(quizData) {
    quizState.questions = quizData.questions || [];
    quizState.currentIndex = 0;
    quizState.answers = {};
    quizState.area = quizData.area || '';
    quizState.difficulty = quizData.difficulty || 'mid';
    quizState.interviewId = quizData.interviewId || null;

    if (quizState.timerInterval) clearInterval(quizState.timerInterval);
    quizState.startTime = Date.now();
    quizState.timerInterval = setInterval(updateQuizTimer, 1000);
    document.getElementById('quiz-timer').textContent = '10:00';
    document.getElementById('quiz-timer').style.color = '#7D8593';

    document.getElementById('quiz-area-badge').textContent = quizData.area + ' [' + difficultyLabel(quizData.difficulty) + ']';

    showAppView('quiz');
    renderQuizQuestion();
  }

  function updateQuizTimer() {
    var elapsed = Math.floor((Date.now() - quizState.startTime) / 1000);
    var remaining = Math.max(0, 600 - elapsed);
    var min = Math.floor(remaining / 60);
    var sec = remaining % 60;
    var display = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
    document.getElementById('quiz-timer').textContent = display;
    if (remaining <= 60) {
      document.getElementById('quiz-timer').style.color = '#D96B6B';
    } else if (remaining <= 180) {
      document.getElementById('quiz-timer').style.color = '#D6A54A';
    }
    if (remaining === 0) {
      clearInterval(quizState.timerInterval);
      submitQuizAnswers();
    }
  }

  function renderQuizQuestion() {
    var q = quizState.questions[quizState.currentIndex];
    if (!q) return;

    var total = quizState.questions.length;
    var idx = quizState.currentIndex + 1;

    document.getElementById('quiz-counter').textContent = 'Pregunta ' + idx + ' de ' + total;
    document.getElementById('quiz-question-text').textContent = q.text;
    document.getElementById('quiz-progress').style.width = ((idx / total) * 100) + '%';

    var optionsHtml = '';
    var labels = ['a', 'b', 'c', 'd'];
    var opts = q.options || {};

    labels.forEach(function (l) {
      if (!opts[l]) return;
      var selected = quizState.answers[q.id] === l;
      var optionClass = 'quiz-option' + (selected ? ' quiz-option--selected' : '');
      optionsHtml +=
        '<div class="' + optionClass + '" data-qid="' + q.id + '" data-val="' + l + '">' +
          '<div class="quiz-option__circle">' +
            '<span class="quiz-option__letter">' + l + '</span>' +
          '</div>' +
          '<span style="color:#E6E8EE;font-size:15px">' + escapeHTML(opts[l]) + '</span>' +
        '</div>';
    });

    document.getElementById('quiz-options').className = 'quiz-option-grid';
    document.getElementById('quiz-options').innerHTML = optionsHtml;

    // Click handlers for options
    document.querySelectorAll('.quiz-option').forEach(function (el) {
      el.addEventListener('click', function () {
        var qid = parseInt(this.getAttribute('data-qid'), 10);
        var val = this.getAttribute('data-val');
        quizState.answers[qid] = val;
        renderQuizQuestion();
        updateQuizNav();
      });
    });

    updateQuizNav();
  }

  function updateQuizNav() {
    var total = quizState.questions.length;
    var idx = quizState.currentIndex;
    var q = quizState.questions[idx];
    var hasAnswer = q ? quizState.answers[q.id] !== undefined : false;
    var isLastQuestion = idx >= total - 1;

    document.getElementById('quiz-prev-btn').disabled = idx === 0;

    var nextBtn = document.getElementById('quiz-next-btn');
    if (isLastQuestion) {
      nextBtn.textContent = 'Enviar respuestas';
      nextBtn.disabled = !hasAnswer;
    } else {
      nextBtn.textContent = 'Siguiente';
      nextBtn.disabled = !hasAnswer;
    }

    document.getElementById('quiz-selection-status').textContent = hasAnswer ? 'Opción seleccionada' : 'Selecciona una opción';
    document.getElementById('quiz-selection-status').style.color = hasAnswer ? '#4CAF7A' : '#7D8593';
  }

  listen('quiz-prev-btn', 'click', function () {
    if (quizState.currentIndex > 0) { quizState.currentIndex--; renderQuizQuestion(); }
  });

  listen('quiz-next-btn', 'click', function () {
    var isLastQuestion = quizState.currentIndex >= quizState.questions.length - 1;
    if (isLastQuestion) {
      submitQuizAnswers();
    } else {
      quizState.currentIndex++;
      renderQuizQuestion();
    }
  });

  async function submitQuizAnswers() {
    if (quizState.timerInterval) clearInterval(quizState.timerInterval);
    var answers = quizState.questions.map(function (q) {
      return { questionId: q.id, selected: quizState.answers[q.id] || '' };
    });

    try {
      showLoading('Evaluando respuestas...');
      var durationSeconds = Math.floor((Date.now() - quizState.startTime) / 1000);
      var result = await apiRequest('/quiz/submit', 'POST', {
        answers: answers,
        area: quizState.area,
        difficulty: quizState.difficulty,
        interviewId: quizState.interviewId,
        durationSeconds: durationSeconds
      });
      showQuizResults(result);
    } catch (error) {
      showToast('Error: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  function showQuizResults(result) {
    showAppView('quizResults');

    var scoreColor = result.score >= 70 ? '#4CAF7A' : result.score >= 40 ? '#D6A54A' : '#D96B6B';
    var gradeLabel = result.score >= 90 ? 'Excelente' : result.score >= 70 ? 'Bueno' : result.score >= 50 ? 'Regular' : result.score >= 30 ? 'Deficiente' : 'Muy deficiente';

    document.getElementById('quiz-results-summary').innerHTML =
      '<span style="font-size:14px;color:#A7ADB8">' + result.correctCount + ' de ' + result.totalQuestions + ' correctas</span>';

    var correctResults = result.results.filter(function (r) { return r.isCorrect; });
    var incorrectResults = result.results.filter(function (r) { return !r.isCorrect; });

    var html = '';

    // Score gauge
    html +=
      '<div class="bg-surface-container border border-outline-variant rounded-xl p-lg text-center mb-lg" style="background:#20242D">' +
        '<div class="responsive-score" style="background:linear-gradient(135deg, ' + scoreColor + ', ' + (result.score >= 70 ? '#2b8252' : result.score >= 40 ? '#a07820' : '#a04040') + ');-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700">' +
          result.score +
        '</div>' +
        '<div style="font-size:16px;color:' + scoreColor + ';font-weight:600;margin-bottom:4px">' + gradeLabel + '</div>' +
        '<div style="height:8px;background:#2B313C;border-radius:4px;overflow:hidden;max-width:300px;margin:12px auto">' +
          '<div style="height:100%;width:' + result.score + '%;background:' + scoreColor + ';border-radius:4px;transition:width 0.5s ease"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;gap:24px;margin-top:16px">' +
          '<div><span style="color:#4CAF7A;font-size:18px;font-weight:600">' + correctResults.length + '</span><span style="color:#A7ADB8;font-size:13px;margin-left:4px">correctas</span></div>' +
          '<div><span style="color:#D96B6B;font-size:18px;font-weight:600">' + incorrectResults.length + '</span><span style="color:#A7ADB8;font-size:13px;margin-left:4px">incorrectas</span></div>' +
        '</div>' +
      '</div>';

    // Incorrectas primero
    if (incorrectResults.length > 0) {
      html += '<h3 style="color:#D96B6B;font-size:15px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">' +
        '<span class="material-symbols-outlined" style="font-size:18px">cancel</span> Repasa estas preguntas (' + incorrectResults.length + ')</h3>';
      incorrectResults.forEach(function (r, idx) {
        var realIdx = result.results.indexOf(r) + 1;
        html += renderQuizResultCard(r, realIdx, false);
      });
    }

    // Correctas despues
    if (correctResults.length > 0) {
      html += '<h3 style="color:#4CAF7A;font-size:15px;font-weight:600;margin-bottom:12px;margin-top:24px;display:flex;align-items:center;gap:8px">' +
        '<span class="material-symbols-outlined" style="font-size:18px">check_circle</span> Respuestas correctas (' + correctResults.length + ')</h3>';
      correctResults.forEach(function (r, idx) {
        var realIdx = result.results.indexOf(r) + 1;
        html += renderQuizResultCard(r, realIdx, true);
      });
    }

    document.getElementById('quiz-results-content').innerHTML = html;
  }

  function renderQuizResultCard(r, index, isCorrect) {
    var borderColor = isCorrect ? '#4CAF7A' : '#D96B6B';
    var icon = isCorrect ? 'check_circle' : 'cancel';
    var iconColor = isCorrect ? '#4CAF7A' : '#D96B6B';
    var statusLabel = isCorrect ? 'Correcta' : 'Incorrecta';
    var cardClass = isCorrect ? 'quiz-option--correct' : 'quiz-option--incorrect';
    return (
      '<div class="' + cardClass + '" style="padding:16px;margin-bottom:14px;background:#171A21;border-radius:10px">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
          '<span class="material-symbols-outlined" style="color:' + iconColor + ';font-size:18px">' + icon + '</span>' +
          '<span class="meta-item__label" style="color:' + iconColor + '">Pregunta ' + index + ' — ' + statusLabel + '</span>' +
        '</div>' +
        '<p class="eval-section__text" style="font-size:15px;color:#E6E8EE;font-weight:500;margin-bottom:12px;line-height:1.5">' + escapeHTML(r.questionText) + '</p>' +
        '<div class="quiz-option-grid" style="margin-bottom:12px">' +
          renderOptionBlock(r.options, r.selected, r.correctAnswer) +
        '</div>' +
        '<div class="card-elevated card-elevated--sm">' +
          '<span class="meta-item__label" style="color:#5B7CFA">Explicacion</span>' +
          '<p class="eval-section__text" style="margin:6px 0 0">' + escapeHTML(r.explanation) + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  function renderOptionBlock(options, selected, correct) {
    var labels = ['a', 'b', 'c', 'd'];
    var html = '';
    labels.forEach(function (l) {
      if (!options[l]) return;
      var isSelected = l === selected;
      var isCorrect = l === correct;
      var optionClass = isCorrect ? 'quiz-option--correct' : (isSelected ? 'quiz-option--incorrect' : '');
      var prefix = isCorrect ? '✓' : (isSelected ? '✗' : '');
      var textColor = isCorrect ? '#4CAF7A' : (isSelected ? '#D96B6B' : '#A7ADB8');
      html +=
        '<div class="' + optionClass + '" style="padding:8px 12px;border-radius:6px;display:flex;align-items:center;gap:8px">' +
          '<span class="font-code-sm" style="color:' + textColor + ';font-weight:600;text-transform:uppercase;font-size:11px">' + l + '.</span>' +
          '<span style="font-size:13px;color:' + textColor + '">' + escapeHTML(options[l]) + '</span>' +
          '<span style="margin-left:auto;font-size:12px;color:' + textColor + ';font-weight:600">' + prefix + '</span>' +
        '</div>';
    });
    return html;
  }

  listen('btn-quiz-new', 'click', function () {
    loadAreas();
    showAppView('areas');
  });

  function showEvaluation(evaluation) {
    showAppView('evaluation');
    var container = document.getElementById('evaluation-content');

    var scoreColor = evaluation.score >= 70 ? '#4CAF7A' : evaluation.score >= 40 ? '#D6A54A' : '#D96B6B';
    var scoreGrad = evaluation.score >= 70 ? '#4CAF7A, #2b8252' : evaluation.score >= 40 ? '#D6A54A, #a07820' : '#D96B6B, #a04040';

    var criteriaHtml = '';
    if (evaluation.criteriaScores) {
      var cs = evaluation.criteriaScores;
      var criteria = [
        { key: 'precision', label: 'Precision tecnica', color: '#5B7CFA' },
        { key: 'claridad', label: 'Claridad', color: '#5B7CFA' },
        { key: 'profundidad', label: 'Profundidad', color: '#5B7CFA' },
        { key: 'comunicacion', label: 'Comunicacion', color: '#5B7CFA' }
      ];
      criteriaHtml = '<div class="evaluation-section"><h3>Analisis de competencias</h3>';
      criteria.forEach(function (c) {
        var val = cs[c.key];
        if (typeof val !== 'number') return;
        var cColor = val >= 70 ? '#4CAF7A' : val >= 40 ? '#D6A54A' : '#D96B6B';
        criteriaHtml +=
          '<div style="margin-bottom:12px">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
              '<span style="font-size:14px;color:#A7ADB8">' + c.label + '</span>' +
              '<span style="font-size:14px;color:' + cColor + ';font-weight:600">' + val + '</span>' +
            '</div>' +
            '<div style="height:6px;background:#2B313C;border-radius:4px;overflow:hidden">' +
              '<div style="height:100%;width:' + val + '%;background:' + cColor + ';border-radius:4px;transition:width 0.5s ease"></div>' +
            '</div>' +
          '</div>';
      });
      criteriaHtml += '</div>';
    }

    var tagsHtml = '';
    if (evaluation.tags && evaluation.tags.length > 0) {
      tagsHtml = '<div class="evaluation-section" style="margin-bottom:24px">' +
        '<h3 style="font-size:16px;font-weight:600;color:#E6E8EE;margin-bottom:8px">Habilidades detectadas</h3>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      evaluation.tags.forEach(function (tag) {
        tagsHtml += '<span class="tag-chip" style="padding:4px 10px;font-size:12px">' + escapeHTML(tag) + '</span>';
      });
      tagsHtml += '</div></div>';
    }

    container.innerHTML =
      '<div class="evaluation-card">' +
        '<div class="evaluation-score">' +
          '<div class="responsive-score" style="background:linear-gradient(135deg, ' + scoreGrad + ');-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;margin-bottom:8px">' +
            evaluation.score +
          '</div>' +
          '<div class="score-label" style="font-size:14px;color:#A7ADB8">Puntuacion sobre 100</div>' +
        '</div>' +
        '<div class="evaluation-section">' +
          '<h3>Feedback</h3>' +
          '<p>' + escapeHTML(evaluation.feedback) + '</p>' +
        '</div>' +
        criteriaHtml +
        tagsHtml +
        (evaluation.strengths ? '<div class="evaluation-section"><h3>Fortalezas</h3><p>' + escapeHTML(evaluation.strengths) + '</p></div>' : '') +
        (evaluation.improvements ? '<div class="evaluation-section"><h3>Areas de mejora</h3><p>' + escapeHTML(evaluation.improvements) + '</p></div>' : '') +
      '</div>';
  }

  listen('btn-new-interview', 'click', function () {
    loadAreas();
    showAppView('areas');
  });

  // ─── History ────────────────────────────────────────

  async function loadHistory(page) {
    try {
      showLoading('Cargando historial...');
      page = page || state.historyPage || 1;
      state.historyPage = page;

      var filters = state.historyFilters || {};
      var query = '?page=' + page + '&limit=10';
      if (filters.search) query += '&search=' + encodeURIComponent(filters.search);
      if (filters.type) query += '&type=' + filters.type;
      if (filters.difficulty) query += '&difficulty=' + filters.difficulty;
      if (filters.scoreMin) query += '&scoreMin=' + filters.scoreMin;
      if (filters.scoreMax) query += '&scoreMax=' + filters.scoreMax;

      var result = await apiRequest('/history' + query);
      var items = result;
      var pagination = null;
      if (result.data !== undefined) {
        items = result.data;
        pagination = result.pagination;
      }
      renderHistory(items, pagination);
    } catch (error) {
      showToast('Error al cargar historial: ' + error.message);
      document.getElementById('history-list').innerHTML =
        '<div class="empty-state">Error al cargar el historial.</div>';
    } finally {
      hideLoading();
    }
  }

  function getDifficultyBadge(difficulty) {
    var level = difficulty || 'mid';
    return '<span class="badge-difficulty badge-difficulty--' + level + '">' + level + '</span>';
  }

  function renderHistory(items, pagination) {
    var list = document.getElementById('history-list');
    var paginationEl = document.getElementById('history-pagination');
    if (!items || items.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay entrevistas realizadas aun.</div>';
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    list.innerHTML = '';
    items.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'history-item' + (item.status === 'in_progress' ? ' clickable' : '');
      var date = new Date(item.started_at).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      var statusLabel = '';
      if (item.status === 'in_progress') statusLabel = ' (en curso)';
      if (item.status === 'abandoned') statusLabel = ' (abandonada)';
      var badge = getDifficultyBadge(item.difficulty_level);
      var typeLabel = item.type === 'quiz' ? 'Cuestionario' : 'Chat IA';
      var typeClass = 'badge-type badge-type--' + (item.type === 'quiz' ? 'quiz' : 'chat');
      div.innerHTML =
        '<div class="history-item-inner">' +
          '<div class="history-info" style="flex:1;min-width:0">' +
            '<div class="history-area">' + escapeHTML(item.area_name) + statusLabel + '</div>' +
            '<div class="history-date" style="margin-top:4px">' + date + ' ' + badge +
            ' <span class="' + typeClass + '">' + typeLabel + '</span></div>' +
          '</div>' +
          '<div class="history-actions">' +
            '<div class="history-score" style="text-align:right">' + (item.score !== null ? item.score : '-') + '</div>' +
            '<button class="btn-view-session" data-id="' + item.id + '" style="background:transparent;color:#5B7CFA;border:1px solid #2B313C;padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.2s;white-space:nowrap">Detalle</button>' +
            '<button class="btn-delete-interview" data-id="' + item.id + '" title="Eliminar" style="background:transparent;color:#D96B6B;border:1px solid #D96B6B;padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.2s;white-space:nowrap">Eliminar</button>' +
          '</div>' +
        '</div>';
      if (item.status === 'in_progress') {
        div.addEventListener('click', function (e) {
          if (e.target.classList.contains('btn-delete-interview') || e.target.classList.contains('btn-view-session')) return;
          var areaName = item.area_name;
          getAreaIdByName(areaName, function (id) {
            if (id) startInterview(id, areaName);
          });
        });
      }
      list.appendChild(div);
    });

    // Paginacion
    if (paginationEl) {
      if (pagination && pagination.totalPages > 1) {
        var pHtml = '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:16px">';
        if (pagination.page > 1) {
          pHtml += '<button class="pag-btn" data-page="' + (pagination.page - 1) + '" style="background:transparent;color:#A7ADB8;border:1px solid #2B313C;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer">Anterior</button>';
        }
        pHtml += '<span style="font-size:13px;color:#A7ADB8">Pag ' + pagination.page + ' de ' + pagination.totalPages + '</span>';
        if (pagination.page < pagination.totalPages) {
          pHtml += '<button class="pag-btn" data-page="' + (pagination.page + 1) + '" style="background:transparent;color:#A7ADB8;border:1px solid #2B313C;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer">Siguiente</button>';
        }
        pHtml += '</div>';
        paginationEl.innerHTML = pHtml;

        paginationEl.querySelectorAll('.pag-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            loadHistory(parseInt(this.getAttribute('data-page'), 10));
          });
        });
      } else {
        paginationEl.innerHTML = '';
      }
    }

    // Session detail buttons
    document.querySelectorAll('.btn-view-session').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var interviewId = this.getAttribute('data-id');
        loadSessionDetail(interviewId);
      });
    });

    // Delete buttons
    document.querySelectorAll('.btn-delete-interview').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var interviewId = this.getAttribute('data-id');
        if (confirm('Eliminar esta entrevista?')) {
          apiRequest('/history/' + interviewId, 'DELETE')
            .then(function () {
              loadHistory();
              showToast('Entrevista eliminada');
            })
            .catch(function (err) {
              showToast('Error al eliminar: ' + err.message);
            });
        }
      });
    });
  }

  // ─── History Filters ────────────────────────────────

  function readFilterValues() {
    var searchEl = document.getElementById('history-filter-search');
    var typeEl = document.getElementById('history-filter-type');
    var diffEl = document.getElementById('history-filter-difficulty');
    return {
      search: searchEl ? searchEl.value : '',
      type: typeEl ? typeEl.value : '',
      difficulty: diffEl ? diffEl.value : '',
      scoreMin: state.historyFilters.scoreMin || '',
      scoreMax: state.historyFilters.scoreMax || ''
    };
  }

  listen('history-filter-apply', 'click', function () {
    state.historyFilters = readFilterValues();
    state.historyPage = 1;
    loadHistory(1);
  });

  listen('history-filter-search', 'keydown', function (e) {
    if (e.key === 'Enter') {
      state.historyFilters = readFilterValues();
      state.historyPage = 1;
      loadHistory(1);
    }
  });

  // ─── Session Detail ─────────────────────────────────

  async function loadSessionDetail(interviewId) {
    try {
      showLoading('Cargando detalle...');
      var result = await apiRequest('/history/' + interviewId);
      renderSessionDetail(result.session, result.transcript);
      showAppView('session');
    } catch (error) {
      showToast('Error al cargar detalle: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  function renderSessionDetail(session, transcript) {
    var typeTag = session.type === 'quiz' ? 'Cuestionario' : 'Chat IA';
    document.getElementById('session-detail-title').textContent = session.area_name + ' — ' + difficultyLabel(session.difficulty_level) + ' [' + typeTag + ']';
    var date = new Date(session.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    var duration = '';
    if (session.duration_seconds) {
      var min = Math.floor(session.duration_seconds / 60);
      var seg = session.duration_seconds % 60;
      duration = min + 'm ' + seg + 's';
    }

    document.getElementById('session-meta').innerHTML =
      '<div class="meta-grid-responsive">' +
        '<div class="meta-item"><span class="meta-item__label">Fecha</span><p class="meta-item__value">' + date + '</p></div>' +
        '<div class="meta-item"><span class="meta-item__label">Duracion</span><p class="meta-item__value">' + (duration || '—') + '</p></div>' +
        '<div class="meta-item"><span class="meta-item__label">Preguntas</span><p class="meta-item__value">' + (session.questions_answered || 0) + '</p></div>' +
        '<div class="meta-item"><span class="meta-item__label">Puntuacion</span><p class="meta-item__value" style="color:#5B7CFA;font-weight:600">' + (session.score !== null ? session.score + '/100' : '—') + '</p></div>' +
      '</div>';

    // Evaluacion
    var evalDiv = document.getElementById('session-evaluation');
    if (session.feedback) {
      var evalHtml = '<div class="card-elevated card-elevated--sm" style="margin-bottom:16px">';
      evalHtml += '<h3 style="font-size:14px;font-weight:600;color:#E6E8EE;margin-bottom:8px">Sintesis del evaluador</h3>';
      evalHtml += '<p class="eval-section__text">' + escapeHTML(session.feedback) + '</p>';

      if (session.strengths) {
        evalHtml += '<div style="margin-top:12px;padding:10px 14px;background:rgba(76,175,122,0.1);border:1px solid rgba(76,175,122,0.2);border-radius:6px">' +
          '<span class="score-color--high" style="font-size:12px;font-weight:600">Fortalezas:</span> ' +
          '<span style="color:#A7ADB8;font-size:13px">' + escapeHTML(session.strengths) + '</span></div>';
      }
      if (session.improvements) {
        evalHtml += '<div style="margin-top:8px;padding:10px 14px;background:rgba(214,165,74,0.1);border:1px solid rgba(214,165,74,0.2);border-radius:6px">' +
          '<span style="color:#D6A54A;font-size:12px;font-weight:600">Mejora:</span> ' +
          '<span style="color:#A7ADB8;font-size:13px">' + escapeHTML(session.improvements) + '</span></div>';
      }

      if (session.tags) {
        evalHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">';
        session.tags.forEach(function (tag) {
          evalHtml += '<span class="tag-chip">' + escapeHTML(tag) + '</span>';
        });
        evalHtml += '</div>';
      }
      evalHtml += '</div>';
      evalDiv.innerHTML = evalHtml;
    } else {
      evalDiv.innerHTML = '';
    }

    // Transcripcion
    var transcriptDiv = document.getElementById('session-transcript');

    if (session.type === 'quiz') {
      var quizResults = null;
      if (session.criteria_scores && typeof session.criteria_scores === 'object' && session.criteria_scores.quizResults) {
        quizResults = session.criteria_scores.quizResults;
      } else if (session.criteria_scores && typeof session.criteria_scores === 'string') {
        try {
          var parsed = JSON.parse(session.criteria_scores);
          quizResults = parsed.quizResults || null;
        } catch (e) {}
      }

      if (quizResults && quizResults.length > 0) {
        var qHtml = '';
        quizResults.forEach(function (r, i) {
          var icon = r.isCorrect ? 'check_circle' : 'cancel';
          var iconColor = r.isCorrect ? '#4CAF7A' : '#D96B6B';
          var statusLabel = r.isCorrect ? 'Correcta' : 'Incorrecta';
          var cardClass = r.isCorrect ? 'quiz-option--correct' : 'quiz-option--incorrect';
          qHtml +=
            '<div class="' + cardClass + '" style="border-radius:8px;padding:14px;margin-bottom:12px;background:#171A21">' +
              '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
                '<span class="material-symbols-outlined" style="color:' + iconColor + ';font-size:16px">' + icon + '</span>' +
                '<span class="meta-item__label" style="color:' + iconColor + '">Pregunta ' + (i + 1) + ' — ' + statusLabel + '</span>' +
              '</div>' +
              '<p style="font-size:14px;color:#E6E8EE;margin-bottom:8px;line-height:1.4">' + escapeHTML(r.questionText) + '</p>' +
              '<div style="font-size:12px;margin-bottom:6px">' +
                '<span style="color:#7D8593">Tu respuesta: </span>' +
                '<span style="color:' + (r.isCorrect ? '#4CAF7A' : '#D96B6B') + ';font-weight:600">' + escapeHTML(r.options[r.selected] || r.selected) + '</span>' +
              '</div>' +
              (!r.isCorrect ? '<div style="font-size:12px;margin-bottom:6px"><span style="color:#7D8593">Respuesta correcta: </span><span style="color:#4CAF7A;font-weight:600">' + escapeHTML(r.options[r.correctAnswer] || r.correctAnswer) + '</span></div>' : '') +
              (r.explanation ? '<div class="card-elevated card-elevated--sm" style="margin-top:8px"><span class="meta-item__label" style="color:#5B7CFA">Explicacion</span><p class="eval-section__text" style="margin:4px 0 0">' + escapeHTML(r.explanation) + '</p></div>' : '') +
            '</div>';
        });
        transcriptDiv.innerHTML = qHtml;
      } else {
        transcriptDiv.innerHTML = '<div style="text-align:center;padding:24px;color:#7D8593;font-size:14px">Resultados del cuestionario no disponibles.</div>';
      }
    } else if (transcript && transcript.length > 0) {
      var tHtml = '';
      transcript.forEach(function (turn) {
        tHtml +=
          '<div style="margin-bottom:16px">' +
            '<div class="message system" style="max-width:85%;margin-bottom:8px">' +
              '<p>' + escapeHTML(turn.question_text) + '</p>' +
            '</div>' +
            (turn.answer_text
              ? '<div class="message user" style="max-width:85%;margin-bottom:6px">' +
                  '<p>' + escapeHTML(turn.answer_text) + '</p>' +
                '</div>'
              : '<div style="max-width:85%;padding:8px 12px;color:#7D8593;font-size:13px;font-style:italic">Sin respuesta</div>') +
            (turn.ai_feedback
              ? '<div style="margin-left:16px;padding:8px 12px;background:#171A21;border:1px solid #2B313C;border-left:3px solid #5B7CFA;border-radius:6px;max-width:75%">' +
                  '<span style="font-size:10px;text-transform:uppercase;color:#5B7CFA;font-family:JetBrains Mono">Feedback IA' +
                    (turn.ai_score ? ' — ' + turn.ai_score + '/100' : '') + '</span>' +
                  '<p style="font-size:13px;color:#7D8593;margin:4px 0 0">' + escapeHTML(turn.ai_feedback) + '</p>' +
                '</div>'
              : '') +
          '</div>';
      });
      transcriptDiv.innerHTML = tHtml;
    } else {
      transcriptDiv.innerHTML = '<div style="text-align:center;padding:24px;color:#7D8593;font-size:14px">No hay transcripcion disponible.</div>';
    }
  }

  listen('btn-back-to-history', 'click', function () {
    state.historyPage = 1;
    loadHistory(1);
    showAppView('history');
  });

  listen('btn-close-session', 'click', function () {
    showAppView('home');
    loadDashboardStats();
  });

  // ─── Utilities ──────────────────────────────────────

  function getAreaIdByName(name, callback) {
    apiRequest('/areas').then(function (areas) {
      var found = areas.find(function (a) { return a.name === name; });
      callback(found ? found.id : null);
    }).catch(function () {
      callback(null);
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast-responsive';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 4000);
  }

  // ─── Expose global functions ─────────────────────────

  window.showAppView = showAppView;
  window.showAuthView = showAuthView;
  window.showApp = showApp;
  window.showLanding = showLanding;

  window.goToLogin = function () {
    showAuthView('login');
  };

  window.goToRegister = function () {
    showAuthView('register');
  };

  window.goLanding = function () {
    showLanding();
  };

  // ─── Landing Mobile Menu ─────────────────────────

  function closeLandingMobileMenu() {
    var menu = document.getElementById('landing-mobile-menu');
    var overlay = document.getElementById('landing-mobile-overlay');
    if (menu) menu.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
  }

  window.closeLandingMobileMenu = closeLandingMobileMenu;

  function initLandingMobileMenu() {
    var btn = document.getElementById('btn-landing-mobile-nav');
    var menu = document.getElementById('landing-mobile-menu');
    var overlay = document.getElementById('landing-mobile-overlay');
    if (!btn || !menu || !overlay) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = !menu.classList.contains('hidden');
      if (isOpen) {
        menu.classList.add('hidden');
        overlay.classList.add('hidden');
      } else {
        menu.classList.remove('hidden');
        overlay.classList.remove('hidden');
      }
    });

    overlay.addEventListener('click', closeLandingMobileMenu);

    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        closeLandingMobileMenu();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 641) {
        closeLandingMobileMenu();
      }
    });
  }

  initLandingMobileMenu();

  window.goHome = function () {
    showAppView('home');
    loadDashboardStats();
  };

  window.goToHistory = function () {
    state.historyPage = 1;
    loadHistory();
    showAppView('history');
  };

  window.setDifficultyJS = function (level) {
    state.difficultyLevel = level;
    var label = document.getElementById('selected-difficulty-label');
    if (label) label.textContent = 'Nivel: ' + (level === 'junior' ? 'Junior' : level === 'senior' ? 'Senior' : 'Mid');
  };

})();
