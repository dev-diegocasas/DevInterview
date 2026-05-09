(function () {
  'use strict';

  var API_BASE = '/api';
  var MAX_QUESTIONS = 5;

  var state = {
    token: null,
    user: null,
    areaId: null,
    areaName: '',
    interviewId: null,
    currentQuestion: null,
    questionNumber: 0,
    questionsAndAnswers: [],
    isProcessing: false
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
    history: document.getElementById('view-history')
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
      appViews[key].classList.remove('view-active');
      appViews[key].classList.add('view-hidden');
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
    loadHistory();
    showAppView('history');
  });

  document.getElementById('btn-history-home').addEventListener('click', function () {
    loadHistory();
    showAppView('history');
  });

  document.getElementById('btn-back-home').addEventListener('click', function () {
    showAppView('home');
  });

  // ─── Areas ──────────────────────────────────────────

  async function loadAreas() {
    try {
      showLoading('Cargando areas...');
      var areas = await apiRequest('/areas');
      renderAreas(areas);
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
      card.innerHTML = '<h3>' + escapeHTML(area.name) + '</h3><p>' + escapeHTML(area.description) + '</p>';
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

      var result = await apiRequest('/interview/start', 'POST', { areaId: areaId });
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
    document.getElementById('chat-area-name').textContent = state.areaName;
    updateQuestionCounter();
  }

  function updateQuestionCounter() {
    document.getElementById('chat-question-counter').textContent =
      'Pregunta ' + state.questionNumber + ' de ' + MAX_QUESTIONS;
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
      showLoading(state.questionNumber >= MAX_QUESTIONS ? 'Generando evaluacion final...' : 'Generando siguiente pregunta...');
      var result = await apiRequest('/interview/answer', 'POST', {
        interviewId: state.interviewId,
        questionId: state.currentQuestion.id,
        answer: answer,
        questionNumber: state.questionNumber,
        areaName: state.areaName
      });

      if (result.finished) {
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

    var scoreColor = evaluation.score >= 70 ? '#10b981' : evaluation.score >= 40 ? '#f59e0b' : '#ef4444';

    container.innerHTML =
      '<div class="evaluation-card">' +
        '<div class="evaluation-score">' +
          '<div class="score-number" style="background: linear-gradient(135deg, ' + scoreColor + ', #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">' +
            evaluation.score +
          '</div>' +
          '<div class="score-label">Puntuacion sobre 100</div>' +
        '</div>' +
        '<div class="evaluation-section">' +
          '<h3>Feedback</h3>' +
          '<p>' + escapeHTML(evaluation.feedback) + '</p>' +
        '</div>' +
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
  });

  // ─── History ────────────────────────────────────────

  async function loadHistory() {
    try {
      showLoading('Cargando historial...');
      var history = await apiRequest('/history');
      renderHistory(history);
    } catch (error) {
      showToast('Error al cargar historial: ' + error.message);
      document.getElementById('history-list').innerHTML =
        '<div class="empty-state">Error al cargar el historial.</div>';
    } finally {
      hideLoading();
    }
  }

  function renderHistory(items) {
    var list = document.getElementById('history-list');
    if (!items || items.length === 0) {
      list.innerHTML = '<div class="empty-state">No hay entrevistas realizadas aun.</div>';
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
      div.innerHTML =
        '<div class="history-info">' +
          '<div class="history-area">' + escapeHTML(item.area_name) + statusLabel + '</div>' +
          '<div class="history-date">' + date + '</div>' +
        '</div>' +
        '<div class="history-score">' + (item.score !== null ? item.score : '-') + '</div>' +
        '<button class="btn-delete-interview" data-id="' + item.id + '" title="Eliminar">Eliminar</button>';
      if (item.status === 'in_progress') {
        div.addEventListener('click', function (e) {
          if (e.target.classList.contains('btn-delete-interview')) return;
          var areaId = item.area_id;
          var areaName = item.area_name;
          getAreaIdByName(areaName, function (id) {
            startInterview(id, areaName);
          });
        });
      }
      list.appendChild(div);
    });

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

  function getAreaIdByName(name, callback) {
    apiRequest('/areas').then(function (areas) {
      var found = areas.find(function (a) { return a.name === name; });
      callback(found ? found.id : null);
    }).catch(function () {
      callback(null);
    });
  }

  document.getElementById('btn-home-from-history').addEventListener('click', function () {
    showAppView('home');
  });

  // ─── Utilities ──────────────────────────────────────

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

})();
