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
    session: document.getElementById('view-session-detail')
  };

  var loadingOverlay = document.getElementById('loading-overlay');
  var loadingText = document.getElementById('loading-text');

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

  // ─── AUTH: Session check on load ─────────────────────

  var savedToken = localStorage.getItem('token');
  if (savedToken) {
    state.token = savedToken;
    verifySession();
  } else {
    showAuthView('login');
  }

  async function verifySession() {
    try {
      var data = await apiRequest('/auth/me');
      state.user = data.user;
      document.getElementById('nav-user-name').textContent = state.user.fullName;
      state.difficultyLevel = state.user.techLevel || 'mid';
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

  document.getElementById('btn-logout').addEventListener('click', async function () {
    try {
      await apiRequest('/auth/logout', 'POST');
    } catch (e) {}
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    showAuthView('login');
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

  document.getElementById('btn-back-home').addEventListener('click', function () {
    showAppView('home');
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
      card.className = 'area-card';
      var popularBadge = area.popular ? ' <span class="bg-primary/10 text-primary text-label-uppercase px-sm py-[2px] rounded-full border border-primary/20" style="font-size:10px">Popular</span>' : '';
      card.innerHTML = '<h3>' + escapeHTML(area.name) + popularBadge + '</h3><p>' + escapeHTML(area.description) + '</p>';
      card.addEventListener('click', function () {
        startInterview(area.id, area.name);
      });
      grid.appendChild(card);
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

  // ─── Evaluation ─────────────────────────────────────

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

  document.getElementById('btn-home-from-eval').addEventListener('click', function () {
    showAppView('home');
    loadDashboardStats();
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
