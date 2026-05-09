(function () {
  'use strict';

  var API_BASE = '/api';
  var MAX_QUESTIONS = 5;

  var state = {
    token: null,
    user: null,
    areaId: null,
    areaName: '',
    difficultyLevel: 'mid',
    interviewId: null,
    currentQuestion: null,
    questionNumber: 0,
    questionsAndAnswers: [],
    isProcessing: false,
    historyPage: 1,
    historyFilters: { search: '', areaId: '', difficulty: '', scoreMin: '', scoreMax: '' }
  };

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
    showAuthView('login');
    checkResetToken();
  }

  async function verifySession() {
    try {
      var data = await apiRequest('/auth/me');
      state.user = data.user;
      document.getElementById('nav-user-name').textContent = state.user.fullName;
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

  document.getElementById('form-login').addEventListener('submit', async function (e) {
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

  document.getElementById('form-register').addEventListener('submit', async function (e) {
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

  document.getElementById('avatar-trigger').addEventListener('click', function (e) {
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

  document.getElementById('btn-go-profile').addEventListener('click', function () {
    hideDropdown();
    loadProfile();
    showAppView('profile');
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

  document.getElementById('btn-save-profile').addEventListener('click', async function () {
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
      fillDropdown(state.user);
      document.getElementById('profile-saved-msg').classList.remove('hidden');
    } catch (error) {
      showToast('Error: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  });

  document.getElementById('btn-save-password').addEventListener('click', async function () {
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

  document.getElementById('link-to-register').addEventListener('click', function (e) {
    e.preventDefault();
    showAuthView('register');
  });

  document.getElementById('link-to-login').addEventListener('click', function (e) {
    e.preventDefault();
    showAuthView('login');
  });

  // ─── Forgot Password ────────────────────────────────

  document.getElementById('link-forgot-password').addEventListener('click', function (e) {
    e.preventDefault();
    showForgotSection();
  });

  document.getElementById('btn-go-to-reset').addEventListener('click', function () {
    var td = document.getElementById('forgot-token-display');
    var token = td && td.textContent !== '—' ? td.textContent : '';
    showResetSection();
    if (token) { document.getElementById('reset-token').value = token; }
  });

  document.getElementById('link-back-to-login-from-forgot').addEventListener('click', function (e) {
    e.preventDefault();
    showLoginSection();
  });

  document.getElementById('link-back-to-login-from-reset').addEventListener('click', function (e) {
    e.preventDefault();
    showLoginSection();
  });

  document.getElementById('btn-copy-token').addEventListener('click', function () {
    var tokenText = document.getElementById('forgot-token-display').textContent;
    if (tokenText && tokenText !== '—') {
      navigator.clipboard.writeText(tokenText).then(function () {
        document.getElementById('btn-copy-token').textContent = 'Copiado!';
        setTimeout(function () { document.getElementById('btn-copy-token').textContent = 'Copiar'; }, 2000);
      }).catch(function () {});
    }
  });

  document.getElementById('form-forgot').addEventListener('submit', async function (e) {
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
      showLoading('Generando token...');
      var data = await apiRequest('/auth/forgot-password', 'POST', { email: email });
      if (data.emailSkipped) {
        document.getElementById('forgot-success-text').textContent = data.message || 'Servicio de email no disponible. Usa el token manualmente.';
        document.getElementById('forgot-token-display').textContent = data.token || '—';
        var contBtn = document.getElementById('btn-go-to-reset');
        if (contBtn) contBtn.style.display = 'block';
        successEl.classList.remove('hidden');
      } else {
        document.getElementById('forgot-success-text').textContent = data.message || 'Revisa tu correo para continuar.';
        document.getElementById('forgot-token-display').textContent = '—';
        var contBtn2 = document.getElementById('btn-go-to-reset');
        if (contBtn2) contBtn2.style.display = 'none';
        successEl.classList.remove('hidden');
      }
      document.getElementById('forgot-email').value = '';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('view-hidden');
    } finally {
      hideLoading();
    }
  });

  document.getElementById('form-reset').addEventListener('submit', async function (e) {
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

  document.getElementById('btn-start').addEventListener('click', function () {
    loadAreas();
    showAppView('areas');
  });

  document.getElementById('btn-start-home').addEventListener('click', function () {
    loadAreas();
    showAppView('areas');
  });

  document.getElementById('btn-history-nav').addEventListener('click', function () {
    state.historyPage = 1;
    loadHistory();
    showAppView('history');
  });

  document.getElementById('btn-history-home').addEventListener('click', function () {
    state.historyPage = 1;
    loadHistory();
    showAppView('history');
  });

  // ─── Dashboard Stats ────────────────────────────────

  async function loadDashboardStats() {
    try {
      var stats = await apiRequest('/dashboard/stats');
      document.getElementById('stat-total').textContent = stats.totalInterviews;
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
        ? '<span class="bg-primary/10 text-primary text-label-uppercase px-sm py-[2px] rounded-full border border-primary/20" style="font-size:10px;font-family:JetBrains Mono">Popular</span>'
        : '';

      var iconHtml = area.icon
        ? '<span class="material-symbols-outlined" style="font-size:32px;color:#5B7CFA">' + escapeHTML(area.icon) + '</span>'
        : '<span class="material-symbols-outlined" style="font-size:32px;color:#5B7CFA">code</span>';

      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="padding:8px;background:rgba(91,124,250,0.1);border-radius:8px">' + iconHtml + '</div>' +
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
          '<div style="display:flex;gap:6px;margin-bottom:12px">' +
            '<button class="diff-btn" data-area="' + area.id + '" data-level="junior" style="flex:1;padding:6px 0;border-radius:6px;font-size:13px;cursor:pointer;transition:all 0.15s;border:1px solid ' + (selectedDiff === 'junior' ? '#5B7CFA' : '#2B313C') + ';background:' + (selectedDiff === 'junior' ? 'rgba(91,124,250,0.1)' : 'transparent') + ';color:' + (selectedDiff === 'junior' ? '#5B7CFA' : '#A7ADB8') + ';font-weight:' + (selectedDiff === 'junior' ? '600' : '400') + '">Junior</button>' +
            '<button class="diff-btn" data-area="' + area.id + '" data-level="mid" style="flex:1;padding:6px 0;border-radius:6px;font-size:13px;cursor:pointer;transition:all 0.15s;border:1px solid ' + (selectedDiff === 'mid' ? '#5B7CFA' : '#2B313C') + ';background:' + (selectedDiff === 'mid' ? 'rgba(91,124,250,0.1)' : 'transparent') + ';color:' + (selectedDiff === 'mid' ? '#5B7CFA' : '#A7ADB8') + ';font-weight:' + (selectedDiff === 'mid' ? '600' : '400') + '">Mid</button>' +
            '<button class="diff-btn" data-area="' + area.id + '" data-level="senior" style="flex:1;padding:6px 0;border-radius:6px;font-size:13px;cursor:pointer;transition:all 0.15s;border:1px solid ' + (selectedDiff === 'senior' ? '#5B7CFA' : '#2B313C') + ';background:' + (selectedDiff === 'senior' ? 'rgba(91,124,250,0.1)' : 'transparent') + ';color:' + (selectedDiff === 'senior' ? '#5B7CFA' : '#A7ADB8') + ';font-weight:' + (selectedDiff === 'senior' ? '600' : '400') + '">Senior</button>' +
          '</div>' +
          '<button class="start-interview-btn" data-area-id="' + area.id + '" data-area-name="' + escapeHTML(area.name) + '" style="width:100%;background:#5B7CFA;color:#E6E8EE;border:none;padding:10px 0;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.15s">Iniciar Entrevista</button>' +
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
          b.style.borderColor = isActive ? '#5B7CFA' : '#2B313C';
          b.style.background = isActive ? 'rgba(91,124,250,0.1)' : 'transparent';
          b.style.color = isActive ? '#5B7CFA' : '#A7ADB8';
          b.style.fontWeight = isActive ? '600' : '400';
        });
        state.difficultyLevel = level;
      });
    });

    // Event delegation: start buttons
    document.querySelectorAll('.start-interview-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var areaId = parseInt(this.getAttribute('data-area-id'), 10);
        var areaName = this.getAttribute('data-area-name');
        startInterview(areaId, areaName);
      });
    });
  }

  // ─── Interview Flow ─────────────────────────────────

  async function startInterview(areaId, areaName) {
    try {
      showLoading('Preparando entrevista...');
      state.areaId = areaId;
      state.areaName = areaName;

      var result = await apiRequest('/interview/start', 'POST', {
        areaId: areaId,
        difficultyLevel: state.difficultyLevel
      });

      if (result.quizMode) {
        startQuiz(result.quiz);
        return;
      }

      state.interviewId = result.interviewId;

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
    msg.style.cssText = 'align-self:flex-start;background:#171A21;border:1px solid #2B313C;border-left:3px solid ' + scoreColor + ';border-radius:8px;padding:10px 14px;margin-bottom:12px;max-width:80%';
    document.getElementById('chat-messages').appendChild(msg);
    scrollToBottom();
  }

  function scrollToBottom() {
    var messagesDiv = document.getElementById('chat-messages');
    setTimeout(function () {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, 100);
  }

  document.getElementById('btn-send').addEventListener('click', submitAnswerHandler);
  document.getElementById('chat-input').addEventListener('keydown', function (e) {
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

  var quizState = { questions: [], currentIndex: 0, answers: {}, area: '', difficulty: '' };

  function startQuiz(quizData) {
    quizState.questions = quizData.questions || [];
    quizState.currentIndex = 0;
    quizState.answers = {};
    quizState.area = quizData.area || '';
    quizState.difficulty = quizData.difficulty || 'mid';

    document.getElementById('quiz-area-badge').textContent = quizData.area + ' [' + difficultyLabel(quizData.difficulty) + ']';

    showAppView('quiz');
    renderQuizQuestion();
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
      optionsHtml +=
        '<div class="quiz-option" data-qid="' + q.id + '" data-val="' + l + '" style="padding:12px 16px;border-radius:8px;border:1px solid ' + (selected ? '#5B7CFA' : '#2B313C') + ';background:' + (selected ? 'rgba(91,124,250,0.1)' : '#171A21') + ';cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:12px">' +
          '<div style="width:28px;height:28px;border-radius:50%;border:2px solid ' + (selected ? '#5B7CFA' : '#2B313C') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + (selected ? '#5B7CFA' : 'transparent') + '">' +
            '<span style="color:' + (selected ? '#E6E8EE' : '#A7ADB8') + ';font-size:13px;font-weight:600;text-transform:uppercase">' + l + '</span>' +
          '</div>' +
          '<span style="color:#E6E8EE;font-size:15px">' + escapeHTML(opts[l]) + '</span>' +
        '</div>';
    });

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

    document.getElementById('quiz-prev-btn').disabled = idx === 0;
    document.getElementById('quiz-next-btn').disabled = !hasAnswer || idx >= total - 1;

    document.getElementById('quiz-selection-status').textContent = hasAnswer ? 'Opción seleccionada' : 'Selecciona una opción';
    document.getElementById('quiz-selection-status').style.color = hasAnswer ? '#4CAF7A' : '#7D8593';

    var allAnswered = quizState.questions.every(function (q) { return quizState.answers[q.id] !== undefined; });
    var submitBtn = document.getElementById('quiz-submit-btn');
    if (allAnswered) {
      submitBtn.classList.remove('hidden');
      submitBtn.style.display = 'block';
    } else {
      submitBtn.classList.add('hidden');
      submitBtn.style.display = '';
    }
  }

  document.getElementById('quiz-prev-btn').addEventListener('click', function () {
    if (quizState.currentIndex > 0) { quizState.currentIndex--; renderQuizQuestion(); }
  });

  document.getElementById('quiz-next-btn').addEventListener('click', function () {
    if (quizState.currentIndex < quizState.questions.length - 1) { quizState.currentIndex++; renderQuizQuestion(); }
  });

  document.getElementById('quiz-submit-btn').addEventListener('click', async function () {
    var answers = quizState.questions.map(function (q) {
      return { questionId: q.id, selected: quizState.answers[q.id] || '' };
    });

    try {
      showLoading('Evaluando respuestas...');
      var result = await apiRequest('/quiz/submit', 'POST', {
        answers: answers,
        area: quizState.area,
        difficulty: quizState.difficulty
      });
      showQuizResults(result);
    } catch (error) {
      showToast('Error: ' + error.message);
    } finally {
      hideLoading();
    }
  });

  function showQuizResults(result) {
    showAppView('quizResults');

    var scoreColor = result.score >= 70 ? '#4CAF7A' : result.score >= 40 ? '#D6A54A' : '#D96B6B';
    document.getElementById('quiz-results-summary').textContent =
      result.correctCount + ' de ' + result.totalQuestions + ' correctas — Puntaje: ' + result.score + '/100';

    var html = '';
    result.results.forEach(function (r, i) {
      var isCorrect = r.isCorrect;
      var borderColor = isCorrect ? '#4CAF7A' : '#D96B6B';
      var icon = isCorrect ? 'check_circle' : 'cancel';
      var iconColor = isCorrect ? '#4CAF7A' : '#D96B6B';
      var statusLabel = isCorrect ? 'Correcta' : 'Incorrecta';

      html +=
        '<div class="bg-surface-container border border-outline-variant rounded-xl p-lg" style="border-left:4px solid ' + borderColor + '">' +
          '<div class="flex items-center gap-sm mb-md">' +
            '<span class="material-symbols-outlined" style="color:' + iconColor + ';font-size:20px">' + icon + '</span>' +
            '<span class="font-label-uppercase" style="color:' + iconColor + '">Pregunta ' + (i + 1) + ' — ' + statusLabel + '</span>' +
          '</div>' +
          '<p class="font-body-md text-body-md text-on-surface mb-md" style="font-weight:500">' + escapeHTML(r.questionText) + '</p>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">' +
            renderOptionBlock(r.options, r.selected, r.correctAnswer) +
          '</div>' +
          '<div style="padding:12px;background:#171A21;border-radius:8px;border:1px solid #2B313C">' +
            '<span class="font-label-uppercase" style="color:#5B7CFA;font-size:10px">EXPLICACION</span>' +
            '<p class="font-body-sm text-body-sm text-on-surface-variant mt-xs" style="margin:4px 0 0">' + escapeHTML(r.explanation) + '</p>' +
          '</div>' +
        '</div>';
    });

    document.getElementById('quiz-results-content').innerHTML = html;
  }

  function renderOptionBlock(options, selected, correct) {
    var labels = ['a', 'b', 'c', 'd'];
    var html = '';
    labels.forEach(function (l) {
      if (!options[l]) return;
      var isSelected = l === selected;
      var isCorrect = l === correct;
      var bgColor = isCorrect ? 'rgba(76,175,122,0.15)' : (isSelected && !isCorrect ? 'rgba(217,107,107,0.15)' : '#171A21');
      var borderColor = isCorrect ? '#4CAF7A' : (isSelected && !isCorrect ? '#D96B6B' : '#2B313C');
      var textColor = isCorrect ? '#4CAF7A' : (isSelected && !isCorrect ? '#D96B6B' : '#A7ADB8');
      var prefix = isCorrect ? '✓' : (isSelected ? '✗' : '');
      html +=
        '<div style="padding:8px 12px;border-radius:6px;border:1px solid ' + borderColor + ';background:' + bgColor + ';display:flex;align-items:center;gap:8px">' +
          '<span class="font-code-sm" style="color:' + textColor + ';font-weight:600;text-transform:uppercase;font-size:11px">' + l + '.</span>' +
          '<span style="font-size:13px;color:' + (isCorrect || (isSelected && !isCorrect) ? textColor : '#A7ADB8') + '">' + escapeHTML(options[l]) + '</span>' +
          '<span style="margin-left:auto;font-size:12px;color:' + textColor + ';font-weight:600">' + prefix + '</span>' +
        '</div>';
    });
    return html;
  }

  document.getElementById('btn-quiz-new').addEventListener('click', function () {
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
        tagsHtml += '<span style="background:#20242D;color:#A7ADB8;padding:4px 10px;border-radius:12px;font-size:12px;border:1px solid #2B313C">' + escapeHTML(tag) + '</span>';
      });
      tagsHtml += '</div></div>';
    }

    container.innerHTML =
      '<div class="evaluation-card">' +
        '<div class="evaluation-score">' +
          '<div class="score-number" style="background:linear-gradient(135deg, ' + scoreGrad + ');-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:72px;font-weight:700;line-height:1;margin-bottom:8px">' +
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

  document.getElementById('btn-new-interview').addEventListener('click', function () {
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
    var colors = { junior: { bg: '#4CAF7A', text: '#0F1115' }, mid: { bg: '#5B7CFA', text: '#E6E8EE' }, senior: { bg: '#D6A54A', text: '#0F1115' } };
    var c = colors[difficulty] || colors.mid;
    return '<span style="background:' + c.bg + ';color:' + c.text + ';padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em">' + (difficulty || 'mid') + '</span>';
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
      div.innerHTML =
        '<div class="history-info">' +
          '<div class="history-area">' + escapeHTML(item.area_name) + statusLabel + '</div>' +
          '<div class="history-date" style="margin-top:4px">' + date + ' ' + badge + '</div>' +
        '</div>' +
        '<div class="history-score">' + (item.score !== null ? item.score : '-') + '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn-view-session" data-id="' + item.id + '" style="background:transparent;color:#5B7CFA;border:1px solid #2B313C;padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.2s">Detalle</button>' +
          '<button class="btn-delete-interview" data-id="' + item.id + '" title="Eliminar" style="background:transparent;color:#D96B6B;border:1px solid #D96B6B;padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.2s">Eliminar</button>' +
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

  document.getElementById('history-filter-search') && document.getElementById('history-filter-search').addEventListener('input', function (e) {
    state.historyFilters.search = e.target.value;
  });

  document.getElementById('history-filter-difficulty') && document.getElementById('history-filter-difficulty').addEventListener('change', function (e) {
    state.historyFilters.difficulty = e.target.value;
  });

  document.getElementById('history-filter-apply') && document.getElementById('history-filter-apply').addEventListener('click', function () {
    state.historyPage = 1;
    loadHistory(1);
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
    document.getElementById('session-detail-title').textContent = session.area_name + ' — ' + difficultyLabel(session.difficulty_level);
    var date = new Date(session.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    var duration = '';
    if (session.duration_seconds) {
      var min = Math.floor(session.duration_seconds / 60);
      var seg = session.duration_seconds % 60;
      duration = min + 'm ' + seg + 's';
    }

    document.getElementById('session-meta').innerHTML =
      '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
        '<div><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#7D8593;font-family:JetBrains Mono">Fecha</span><p style="color:#E6E8EE;font-size:16px;margin:2px 0 0">' + date + '</p></div>' +
        '<div><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#7D8593;font-family:JetBrains Mono">Duracion</span><p style="color:#E6E8EE;font-size:16px;margin:2px 0 0">' + (duration || '—') + '</p></div>' +
        '<div><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#7D8593;font-family:JetBrains Mono">Preguntas</span><p style="color:#E6E8EE;font-size:16px;margin:2px 0 0">' + (session.questions_answered || 0) + '</p></div>' +
        '<div><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#7D8593;font-family:JetBrains Mono">Puntuacion</span><p style="color:#5B7CFA;font-size:16px;font-weight:600;margin:2px 0 0">' + (session.score !== null ? session.score + '/100' : '—') + '</p></div>' +
      '</div>';

    // Evaluacion
    var evalDiv = document.getElementById('session-evaluation');
    if (session.feedback) {
      var evalHtml = '<div style="background:#20242D;border:1px solid #2B313C;border-radius:8px;padding:16px;margin-bottom:16px">';
      evalHtml += '<h3 style="font-size:14px;font-weight:600;color:#E6E8EE;margin-bottom:8px">Sintesis del evaluador</h3>';
      evalHtml += '<p style="font-size:14px;color:#A7ADB8;line-height:1.6">' + escapeHTML(session.feedback) + '</p>';

      if (session.strengths) {
        evalHtml += '<div style="margin-top:12px;padding:10px 14px;background:#4CAF7A/10;border:1px solid #4CAF7A/20;border-radius:6px">' +
          '<span style="color:#4CAF7A;font-size:12px;font-weight:600">Fortalezas:</span> ' +
          '<span style="color:#A7ADB8;font-size:13px">' + escapeHTML(session.strengths) + '</span></div>';
      }
      if (session.improvements) {
        evalHtml += '<div style="margin-top:8px;padding:10px 14px;background:#D6A54A/10;border:1px solid #D6A54A/20;border-radius:6px">' +
          '<span style="color:#D6A54A;font-size:12px;font-weight:600">Mejora:</span> ' +
          '<span style="color:#A7ADB8;font-size:13px">' + escapeHTML(session.improvements) + '</span></div>';
      }

      if (session.tags) {
        evalHtml += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">';
        session.tags.forEach(function (tag) {
          evalHtml += '<span style="background:#171A21;color:#A7ADB8;padding:3px 8px;border-radius:10px;font-size:11px;border:1px solid #2B313C">' + escapeHTML(tag) + '</span>';
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
    if (transcript && transcript.length > 0) {
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

  document.getElementById('btn-back-to-history') && document.getElementById('btn-back-to-history').addEventListener('click', function () {
    state.historyPage = 1;
    loadHistory(1);
    showAppView('history');
  });

  document.getElementById('btn-close-session') && document.getElementById('btn-close-session').addEventListener('click', function () {
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
    toast.style.cssText =
      'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);' +
      'background:#1e1e2e;color:#e0e0e0;padding:0.75rem 1.5rem;border-radius:8px;' +
      'border:1px solid #2d2d3f;z-index:200;font-size:0.9rem;animation:fadeIn 0.3s ease;';
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
    document.querySelectorAll('.difficulty-btn').forEach(function (btn) {
      var isActive = btn.getAttribute('data-level') === level;
      btn.className = isActive
        ? 'difficulty-btn px-md py-xs rounded border border-primary bg-primary/10 text-primary text-body-sm font-semibold'
        : 'difficulty-btn px-md py-xs rounded border border-outline-variant text-body-sm text-on-surface-variant hover:bg-surface-bright transition-colors';
    });
    document.getElementById('selected-difficulty-label').textContent =
      'Nivel: ' + (level === 'junior' ? 'Junior' : level === 'senior' ? 'Senior' : 'Mid');
  };

})();
