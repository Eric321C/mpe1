// ==========================================================================
// CLIENT LOGIC: MPE DAILY REPORT SPA
// ==========================================================================

// CONFIGURATION: Set this to your backend API URL if hosting frontend on Cloudflare Pages and backend elsewhere.
// Example: const API_BASE_URL = 'https://laporan-api.onrender.com';
const API_BASE_URL = 'https://mpe1-production.up.railway.app';

if (API_BASE_URL) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    init.credentials = 'include'; // Ensure cookies/session tokens are sent cross-origin

    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = API_BASE_URL + input;
    } else if (input instanceof Request && input.url.startsWith('/api/')) {
      input = new Request(API_BASE_URL + input.url, input);
    }
    return originalFetch(input, init);
  };
}

// Application State
let currentUser = null;
let currentView = 'login';
let currentTab = 'my-reports';
let editingReportId = null;
let editingActivityIndex = null;
let currentReportId = null;
let currentTasksForDate = [];
let allMyTasksData = [];

// DOM Elements
const loadingOverlay = document.getElementById('loading-overlay');
const loginView = document.getElementById('view-login');
const dashboardView = document.getElementById('view-dashboard');

const formLogin = document.getElementById('form-login');
const formRegisterUser = document.getElementById('form-register-user');
const formAddReport = document.getElementById('form-add-report');

const userDisplayName = document.getElementById('user-display-name');
const userAvatarInitials = document.getElementById('user-avatar-initials');

const myReportsList = document.getElementById('my-reports-list');
const myReportsEmpty = document.getElementById('my-reports-empty');

const teamFeedTimeline = document.getElementById('team-feed-timeline');
const teamFeedEmpty = document.getElementById('team-feed-empty');

const reportDateInput = document.getElementById('report-date');

// Logout Modal Elements
const logoutModal = document.getElementById('logout-modal');
const btnCancelLogout = document.getElementById('btn-cancel-logout');
const btnConfirmLogout = document.getElementById('btn-confirm-logout');
const btnLogout = document.querySelector('.btn-logout');

// To-Do Builder Elements
const btnAddTodo = document.getElementById('btn-add-todo');
const todoItemsList = document.getElementById('todo-items-list');

// Employee Grid Directory Elements
const btnRefreshEmployees = document.getElementById('btn-refresh-employees');
const employeesGrid = document.getElementById('employees-grid');
const employeesListView = document.getElementById('employees-list-view');
const employeeDetailView = document.getElementById('employee-detail-view');
const btnBackToEmployees = document.getElementById('btn-back-to-employees');
const employeeReportsTimeline = document.getElementById('employee-reports-timeline');
const selectedEmployeeName = document.getElementById('selected-employee-name');
const selectedEmployeeHandle = document.getElementById('selected-employee-handle');

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Set default report date to today
  setTodayAsDefaultDate();

  // Check user session
  checkSession();

  // Attach Form Submit Handlers
  if (formLogin) formLogin.addEventListener('submit', handleLoginSubmit);
  if (formRegisterUser) formRegisterUser.addEventListener('submit', handleRegisterSubmit);
  if (formAddReport) formAddReport.addEventListener('submit', handleReportSubmit);

  // Attach Logout Confirmation Handlers
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      logoutModal.classList.add('show');
    });
  }

  if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => {
      logoutModal.classList.remove('show');
    });
  }

  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', () => {
      logoutModal.classList.remove('show');
      handleLogout();
    });
  }

  if (logoutModal) {
    logoutModal.addEventListener('click', (e) => {
      if (e.target === logoutModal) {
        logoutModal.classList.remove('show');
      }
    });
  }

  const progressRange = document.getElementById('task-progress-range');
  const progressValLabel = document.getElementById('task-progress-val');
  if (progressRange && progressValLabel) {
    progressRange.addEventListener('input', () => {
      progressValLabel.textContent = `${progressRange.value}%`;
    });
  }

  // Category Pills click handler
  const categoryPills = document.querySelectorAll('#task-category-pills .category-pill');
  const categoryInput = document.getElementById('task-category');
  if (categoryPills.length > 0 && categoryInput) {
    categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        categoryInput.value = pill.getAttribute('data-category');
      });
    });
  }

  const lanjutBesokCheckbox = document.getElementById('task-lanjut-besok');
  const toggleStateLabel = document.getElementById('toggle-state-label');
  if (lanjutBesokCheckbox && toggleStateLabel) {
    lanjutBesokCheckbox.addEventListener('change', () => {
      toggleStateLabel.textContent = lanjutBesokCheckbox.checked ? 'Ya' : 'Tidak';
    });
  }

  const reportDateInput = document.getElementById('report-date');
  const mytasksDateInput = document.getElementById('mytasks-date');
  if (reportDateInput) {
    reportDateInput.addEventListener('change', () => {
      if (mytasksDateInput) mytasksDateInput.value = reportDateInput.value;
      loadSavedActivitiesForDate(reportDateInput.value);
    });
  }
  if (mytasksDateInput) {
    mytasksDateInput.addEventListener('change', () => {
      if (reportDateInput) reportDateInput.value = mytasksDateInput.value;
      loadSavedActivitiesForDate(mytasksDateInput.value);
    });
  }

  // Attach Employee Directory Handlers
  if (btnRefreshEmployees) {
    btnRefreshEmployees.addEventListener('click', () => {
      showToast('Menyegarkan daftar karyawan...', 'info');
      fetchEmployees();
    });
  }

  if (btnBackToEmployees) {
    btnBackToEmployees.addEventListener('click', backToEmployees);
  }

  // Mobile Hamburger menu toggle
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const dashboardHeader = document.querySelector('.dashboard-header');
  if (menuToggleBtn && dashboardHeader) {
    menuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dashboardHeader.classList.toggle('menu-active');
      const icon = menuToggleBtn.querySelector('i');
      if (icon) {
        if (dashboardHeader.classList.contains('menu-active')) {
          icon.className = 'fa-solid fa-xmark';
        } else {
          icon.className = 'fa-solid fa-bars';
        }
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (dashboardHeader.classList.contains('menu-active') && !dashboardHeader.contains(e.target)) {
        dashboardHeader.classList.remove('menu-active');
        const icon = menuToggleBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      }
    });
  }

});


// Set default date picker to local YYYY-MM-DD
function setTodayAsDefaultDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  if (reportDateInput) reportDateInput.value = dateStr;
  const mytasksDateInput = document.getElementById('mytasks-date');
  if (mytasksDateInput) mytasksDateInput.value = dateStr;
  const deadlineInput = document.getElementById('task-deadline');
  if (deadlineInput) deadlineInput.value = dateStr;

  const timeInput = document.getElementById('task-time-input');
  if (timeInput) {
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    timeInput.value = `${hours}:${minutes}`;
  }
}

// ==========================================================================
// SESSION MANAGEMENT
// ==========================================================================
async function checkSession() {
  showLoading(true);
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      setupUserUI();
      navigateTo('dashboard');
      switchTab('dashboard');
    } else {
      navigateTo('login');
    }
  } catch (err) {
    console.error('Session check failed:', err);
    navigateTo('login');
  } finally {
    showLoading(false);
  }
}

function setupUserUI() {
  if (!currentUser) return;
  userDisplayName.textContent = currentUser.nama_lengkap;
  userAvatarInitials.textContent = getInitials(currentUser.nama_lengkap);

  const roleEl = document.querySelector('.user-role');
  if (roleEl) {
    const details = getUserDetails(currentUser.role);
    roleEl.textContent = details.jabatan;
  }

  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = currentUser.role && adminRoles.includes(currentUser.role.toLowerCase());

  // Show/Hide sidebar tabs based on role
  const employeeNavs = ['tab-nav-add-report', 'tab-nav-my-tasks', 'tab-nav-open-tasks', 'tab-nav-calendar', 'tab-nav-my-reports', 'tab-nav-profile'];
  const managerNavs = ['tab-nav-team-feed', 'tab-nav-all-tasks', 'tab-nav-manager-reports', 'tab-nav-performance', 'tab-nav-master-data', 'tab-nav-settings'];

  employeeNavs.forEach(navId => {
    const navEl = document.getElementById(navId);
    if (navEl) {
      if (isAdmin) navEl.classList.add('hidden');
      else navEl.classList.remove('hidden');
    }
  });

  managerNavs.forEach(navId => {
    const navEl = document.getElementById(navId);
    if (navEl) {
      if (isAdmin) navEl.classList.remove('hidden');
      else navEl.classList.add('hidden');
    }
  });

  // Toggle dashboard content containers
  const empDash = document.getElementById('employee-dashboard-content');
  const mgrDash = document.getElementById('manager-dashboard-content');
  if (empDash && mgrDash) {
    if (isAdmin) {
      empDash.classList.add('hidden');
      mgrDash.classList.remove('hidden');
    } else {
      empDash.classList.remove('hidden');
      mgrDash.classList.add('hidden');
    }
  }

  // Populate Dashboard & Profile on UI setup
  loadDashboardData();
  loadProfileData();
}

function getUserDetails(role) {
  const r = (role || '').toLowerCase();
  let jabatan = 'Karyawan';
  let departemen = 'Mineplan Engineering';

  if (r === 'foreman') {
    jabatan = 'Foreman';
  } else if (r === 'supervisor') {
    jabatan = 'Supervisor';
  } else if (r === 'superintendent') {
    jabatan = 'Superintendent';
  } else if (r === 'manager') {
    jabatan = 'Manager';
  } else if (r === 'gm') {
    jabatan = 'GM';
    departemen = 'Operations / Engineering';
  } else if (role) {
    jabatan = role.charAt(0).toUpperCase() + role.slice(1);
  }

  return { jabatan, departemen };
}

// setLoginPortal removed

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

// ==========================================================================
// ROUTER & NAVIGATION
// ==========================================================================
function navigateTo(viewName) {
  // Reset active views
  loginView.classList.remove('active');
  dashboardView.classList.remove('active');

  currentView = viewName;

  if (viewName === 'login') {
    loginView.classList.add('active');
    formLogin.reset();
  } else if (viewName === 'dashboard') {
    dashboardView.classList.add('active');
  }
}

function switchTab(tabName, isEdit = false) {
  // Close mobile menu on tab switch
  const dashboardHeader = document.querySelector('.dashboard-header');
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  if (dashboardHeader && dashboardHeader.classList.contains('menu-active')) {
    dashboardHeader.classList.remove('menu-active');
    if (menuToggleBtn) {
      const icon = menuToggleBtn.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-bars';
    }
  }

  // Update Tab Navigation Buttons
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    const isTarget = tab.getAttribute('onclick').includes(tabName);
    if (isTarget) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update Tab Pane Visibility
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(pane => {
    if (pane.id === `tab-${tabName}`) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  currentTab = tabName;

  // Render Dynamic Tab Header Indicator
  const indicator = document.getElementById('dynamic-tab-indicator');
  if (indicator) {
    const adminRoles = ['superintendent', 'manager', 'gm'];
    const isAdmin = currentUser && currentUser.role && adminRoles.includes(currentUser.role.toLowerCase());

    let num = '';
    let text = '';
    if (tabName === 'dashboard') {
      num = '1';
      text = isAdmin ? 'Dashboard Overview' : 'Dashboard Karyawan';
    }
    else if (tabName === 'add-report') { num = '2'; text = 'Formulir Laporan'; }
    else if (tabName === 'my-tasks') { num = '3'; text = 'Pekerjaan Saya (Kategori)'; }
    else if (tabName === 'open-tasks') { num = '4'; text = 'Status Pekerjaan'; }
    else if (tabName === 'calendar') { num = '5'; text = 'Kalender Kerja'; }
    else if (tabName === 'my-reports') { num = '6'; text = 'Riwayat Laporan'; }
    else if (tabName === 'profile') { num = '7'; text = 'Profil Pengguna'; }
    else if (tabName === 'team-feed') { num = '8'; text = 'Team Activity'; }
    else if (tabName === 'all-tasks') { num = '9'; text = 'All Tasks'; }
    else if (tabName === 'manager-reports') { num = '10'; text = 'Laporan Harian Tim'; }
    else if (tabName === 'performance') { num = '11'; text = 'Performance'; }
    else if (tabName === 'suggestion-box') { num = '12'; text = 'Suggestion Box'; }
    else if (tabName === 'master-data') { num = '13'; text = 'Master Data'; }
    else if (tabName === 'settings') { num = '14'; text = 'Settings'; }

    indicator.innerHTML = `
      <div class="tab-header-indicator">
        <span class="indicator-number">${num}</span>
        <span class="indicator-text">${text}</span>
      </div>
    `;
  }

  // Fetch relevant tab data
  if (tabName === 'dashboard') {
    loadDashboardData();
  } else if (tabName === 'my-reports') {
    fetchMyReports();
  } else if (tabName === 'my-tasks') {
    loadTasksTabs().then(() => {
      renderMyTasksTable('semua');
    });
  } else if (tabName === 'open-tasks') {
    loadTasksTabs().then(() => {
      renderSavedActivitiesList();
    });
  } else if (tabName === 'calendar') {
    loadTasksTabs().then(() => {
      renderCalendarWidget();
    });
  } else if (tabName === 'profile') {
    loadProfileData();
  } else if (tabName === 'team-feed') {
    backToEmployees();
  } else if (tabName === 'all-tasks') {
    loadAllTasksTab();
  } else if (tabName === 'manager-reports') {
    loadManagerReportsTab();
  } else if (tabName === 'performance') {
    loadPerformanceTab();
  } else if (tabName === 'suggestion-box') {
    loadSuggestionsTab();
  } else if (tabName === 'master-data') {
    loadMasterDataTab();
  } else if (tabName === 'settings') {
    loadSettingsTab();
  } else if (tabName === 'add-report') {
    if (!isEdit) {
      editingReportId = null;
      setTodayAsDefaultDate();
    }
    resetActivityFormOnly();
    const activeDate = document.getElementById('report-date').value;
    loadSavedActivitiesForDate(activeDate);
  }
}

// ==========================================================================
// API REQUEST HANDLERS
// ==========================================================================

// 1. LOGIN
async function handleLoginSubmit(e) {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showToast('Username dan password wajib diisi!', 'error');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      setupUserUI();
      showToast(data.message || 'Selamat datang kembali!', 'success');
      navigateTo('dashboard');
      switchTab('dashboard');
    } else {
      showToast(data.error || 'Login gagal.', 'error');
    }
  } catch (err) {
    console.error('Login request failed:', err);
    showToast('Terjadi kesalahan koneksi internet.', 'error');
  } finally {
    showLoading(false);
  }
}

// 2. REGISTER
async function handleRegisterSubmit(e) {
  e.preventDefault();

  const username = document.getElementById('register-username').value.trim();
  const nama_lengkap = document.getElementById('register-nama-lengkap').value.trim();
  const role = document.getElementById('register-role').value;
  const password = document.getElementById('register-password').value;

  // Validasi frontend dasar
  if (!username || !nama_lengkap || !password || !role) {
    showToast('Semua kolom wajib diisi!', 'error');
    return;
  }

  if (username.length < 3 || username.includes(' ')) {
    showToast('Username minimal 3 karakter tanpa spasi!', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password minimal 6 karakter!', 'error');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, nama_lengkap, password, role })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(data.message || 'Registrasi berhasil!', 'success');
      clearRegisterForm();
    } else {
      showToast(data.error || 'Registrasi gagal.', 'error');
    }
  } catch (err) {
    console.error('Register request failed:', err);
    showToast('Terjadi kesalahan koneksi internet.', 'error');
  } finally {
    showLoading(false);
  }
}

function clearRegisterForm() {
  if (formRegisterUser) {
    formRegisterUser.reset();
    const select = document.getElementById('register-role');
    if (select) select.value = "";
  }
}
window.clearRegisterForm = clearRegisterForm;

// 3. LOGOUT
async function handleLogout() {
  showLoading(true);
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) {
      currentUser = null;
      showToast('Anda berhasil keluar.', 'info');
      navigateTo('login');
    } else {
      showToast('Gagal logout, silakan coba lagi.', 'error');
    }
  } catch (err) {
    console.error('Logout failed:', err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}

async function handleReportSubmit(e) {
  e.preventDefault();

  const tanggal = document.getElementById('report-date').value;
  if (!tanggal) {
    showToast('Tanggal wajib diisi!', 'error');
    return;
  }

  // Get values from form fields
  const category = document.getElementById('task-category') ? document.getElementById('task-category').value : 'Umum';

  // Use current local time for new tasks, or form value for edited tasks
  let waktu = '08:30';
  if (editingActivityIndex !== null) {
    waktu = document.getElementById('task-time-input') ? document.getElementById('task-time-input').value : '08:30';
  } else {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    waktu = `${hours}:${minutes}`;
  }

  const title = document.getElementById('task-title-input').value.trim();

  const description = document.getElementById('task-description').value.trim();
  const progress = parseInt(document.getElementById('task-progress-range').value, 10);
  const kendala = document.getElementById('task-kendala-textarea').value.trim();
  const lanjutBesokCheckbox = document.getElementById('task-lanjut-besok');
  const lanjutBesok = lanjutBesokCheckbox ? lanjutBesokCheckbox.checked : false;

  const deadline = document.getElementById('task-deadline').value;
  if (!deadline) {
    showToast('Deadline wajib diisi!', 'error');
    return;
  }

  if (!title) {
    showToast('Pekerjaan / Task wajib diisi!', 'error');
    return;
  }

  if (!description) {
    showToast('Penjelasan Aktivitas wajib diisi!', 'error');
    return;
  }

  // Build the activity object
  const activity = {
    category,
    waktu,
    text: title,
    description,
    progress,
    kendala,
    lanjutBesok,
    deadline
  };

  showLoading(true);

  try {
    // 1. Prepare tasks list
    let updatedTasks = [...currentTasksForDate];
    if (editingActivityIndex !== null) {
      // Update existing
      updatedTasks[editingActivityIndex] = activity;
    } else {
      // Add new
      updatedTasks.push(activity);
    }

    const todo_list = JSON.stringify(updatedTasks);

    // Done list is compiled of completed tasks (progress = 100%)
    const doneItems = [];
    updatedTasks.forEach(t => {
      if (t.progress === 100) {
        doneItems.push(t.text);
      }
    });
    const done_list = doneItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n');

    // Kendala can be combined
    const kendalaItems = [];
    updatedTasks.forEach(t => {
      if (t.kendala) {
        kendalaItems.push(t.kendala);
      }
    });
    const reportKendala = kendalaItems.join('; ');

    const url = currentReportId ? `/api/reports/${currentReportId}` : '/api/reports';
    const method = currentReportId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tanggal, todo_list, done_list, kendala: reportKendala })
    });

    const data = await response.json();

    if (response.ok) {
      showToast(editingActivityIndex !== null ? 'Aktivitas berhasil diperbarui!' : 'Aktivitas berhasil ditambahkan!', 'success');

      // Reset form fields
      resetActivityFormOnly();

      // Reload tasks and dashboard
      await loadSavedActivitiesForDate(tanggal);
      await loadTasksTabs();
      loadDashboardData();
    } else {
      showToast(data.error || 'Gagal menyimpan aktivitas.', 'error');
    }
  } catch (err) {
    console.error('Failed to submit activity:', err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}



// ==========================================================================
// DATA FETCHING & RENDERERS
// ==========================================================================

// 1. GET MY REPORTS
async function fetchMyReports() {
  myReportsList.innerHTML = '<div class="spinner-container" style="grid-column: 1/-1; margin: 40px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';
  myReportsEmpty.classList.add('hidden');

  try {
    const response = await fetch('/api/reports/my');
    if (!response.ok) throw new Error('API return non-ok status');

    const data = await response.json();
    const reports = data.reports;

    myReportsList.innerHTML = '';

    if (!reports || reports.length === 0) {
      myReportsEmpty.classList.remove('hidden');
      return;
    }

    reports.forEach(report => {
      const card = document.createElement('div');
      card.className = 'report-card';

      const formattedDate = formatIndonesianDate(report.tanggal);
      const isTodayReport = isToday(report.tanggal);

      card.innerHTML = `
        <div class="report-card-header">
          <span class="report-date-badge">
            <i class="fa-solid fa-calendar-day"></i>
            <span>${formattedDate}</span>
          </span>
          <div class="report-actions">
            ${isTodayReport ? '<span class="report-age" style="color:var(--success); font-weight:bold;">Hari Ini</span>' : ''}
          </div>
        </div>
        
        <div class="report-card-section">
          <span class="section-title title-todo">
            <i class="fa-solid fa-clipboard-list"></i> Rencana (To-Do)
          </span>
          ${renderTodoListHtml(report.todo_list)}
        </div>

        ${report.done_list ? `
        <div class="report-card-section">
          <span class="section-title title-done">
            <i class="fa-solid fa-check-double"></i> Realisasi (Done)
          </span>
          <div class="report-text">${escapeHtml(report.done_list)}</div>
        </div>
        ` : ''}

        ${report.kendala ? `
        <div class="report-card-section">
          <span class="section-title title-kendala">
            <i class="fa-solid fa-circle-exclamation"></i> Kendala
          </span>
          <div class="report-text" style="border-left: 3px solid var(--warning);">${escapeHtml(report.kendala)}</div>
        </div>
        ` : ''}

        <div class="report-card-footer">
          Dikirim pada ${formatTimestamp(report.created_at)}
        </div>
      `;
      myReportsList.appendChild(card);
    });

  } catch (err) {
    console.error('Fetch my reports error:', err);
    myReportsList.innerHTML = `<p style="color:var(--danger); grid-column:1/-1; text-align:center; padding: 20px;">Gagal mengambil data laporan harian Anda. Silakan coba segarkan halaman.</p>`;
  }
}

// 2. GET TEAM FEED
// ==========================================================================
// EMPLOYEE DIRECTORY & TIMELINE LOGIC
// ==========================================================================
async function fetchEmployees() {
  employeesGrid.innerHTML = '<div class="spinner-container" style="grid-column: 1/-1; margin: 40px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';

  try {
    const response = await fetch('/api/employees');
    if (!response.ok) throw new Error('Failed to fetch employees');

    const data = await response.json();
    const employees = data.employees;

    employeesGrid.innerHTML = '';

    if (!employees || employees.length === 0) {
      employeesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted);">Tidak ada karyawan yang terdaftar.</p>';
      return;
    }

    employees.forEach(emp => {
      const card = document.createElement('div');
      card.className = 'employee-card';
      const initials = getInitials(emp.nama_lengkap);

      card.innerHTML = `
        <div class="avatar">${initials}</div>
        <h3>${escapeHtml(emp.nama_lengkap)}</h3>
        <span class="username">@${escapeHtml(emp.username)}</span>
        <div class="employee-report-badge">
          <i class="fa-solid fa-file-invoice"></i>
          <span>${emp.report_count} Laporan</span>
        </div>
      `;

      card.addEventListener('click', () => {
        viewEmployeeReports(emp.id, emp.nama_lengkap, emp.username);
      });

      employeesGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Fetch employees error:', err);
    employeesGrid.innerHTML = `<p style="color:var(--danger); grid-column:1/-1; text-align:center; padding: 20px;">Gagal mengambil daftar karyawan.</p>`;
  }
}

async function viewEmployeeReports(employeeId, fullName, username) {
  employeesListView.classList.add('hidden');
  employeeDetailView.classList.remove('hidden');

  selectedEmployeeName.textContent = fullName;
  selectedEmployeeHandle.textContent = `@${username}`;

  employeeReportsTimeline.innerHTML = '<div class="spinner-container" style="margin: 40px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';

  try {
    const response = await fetch(`/api/reports/employee/${employeeId}`);
    if (!response.ok) throw new Error('Failed to fetch employee reports');

    const data = await response.json();
    const reports = data.reports;

    employeeReportsTimeline.innerHTML = '';

    if (!reports || reports.length === 0) {
      employeeReportsTimeline.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 40px 0;">Karyawan ini belum mengirimkan laporan.</p>';
      return;
    }

    reports.forEach(report => {
      const timelineItem = document.createElement('div');
      timelineItem.className = 'timeline-item';

      const initials = getInitials(report.nama_lengkap);
      const formattedDate = formatIndonesianDate(report.tanggal);
      const isOwnReport = currentUser && currentUser.id === report.user_id;
      const hasKendalaClass = report.kendala ? 'has-kendala' : '';

      timelineItem.innerHTML = `
        <div class="timeline-marker">
          <div class="timeline-avatar" title="${escapeHtml(report.nama_lengkap)}">
            ${initials}
          </div>
        </div>
        <div class="timeline-content ${hasKendalaClass}">
          <div class="timeline-meta">
            <div class="user-meta-info">
              <span class="feed-username">
                ${escapeHtml(report.nama_lengkap)} 
                ${isOwnReport ? '<span style="font-size:0.75rem; background:rgba(99,102,241,0.2); padding: 2px 6px; border-radius:4px; margin-left:5px; color:var(--primary);">Saya</span>' : ''}
              </span>
              <span class="feed-handle">@${escapeHtml(report.username)}</span>
            </div>
            <div class="feed-date">
              <span class="feed-date-badge">${formattedDate}</span>
              <span class="feed-time-ago">${formatTimeAgo(report.created_at)}</span>
            </div>
          </div>
          
          <div class="timeline-body">
            <div class="report-card-section">
              <span class="section-title title-todo">Rencana (To-Do)</span>
              ${renderTodoListHtml(report.todo_list)}
            </div>
            ${report.done_list ? `
            <div class="report-card-section">
              <span class="section-title title-done">Realisasi (Done)</span>
              <div class="report-text">${escapeHtml(report.done_list)}</div>
            </div>
            ` : ''}
          </div>

          ${report.kendala ? `
          <div class="timeline-body-full">
            <div class="report-card-section">
              <span class="section-title title-kendala">
                <i class="fa-solid fa-triangle-exclamation"></i> Kendala Terdeteksi
              </span>
              <div class="report-text" style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid var(--warning);">${escapeHtml(report.kendala)}</div>
            </div>
          </div>
          ` : ''}
        </div>
      `;
      employeeReportsTimeline.appendChild(timelineItem);
    });
  } catch (err) {
    console.error('Fetch employee reports error:', err);
    employeeReportsTimeline.innerHTML = `<p style="color:var(--danger); text-align:center; padding: 20px;">Gagal mengambil data laporan harian karyawan.</p>`;
  }
}

function backToEmployees() {
  employeeDetailView.classList.add('hidden');
  employeesListView.classList.remove('hidden');
  fetchEmployees();
}

// ==========================================================================
// TO-DO BUILDER LOGIC
// ==========================================================================
let todoItemCount = 0;

function createTodoRow(text = '', description = '', kendala = '', progress = 0, waktu = '08:00') {
  todoItemCount++;
  const card = document.createElement('div');
  card.className = 'todo-item-card';
  card.id = `todo-row-${todoItemCount}`;

  card.innerHTML = `
    <div class="todo-card-header">
      <span class="todo-card-title">
        <i class="fa-solid fa-list-check"></i> Tugas #<span class="todo-num">${todoItemCount}</span>
      </span>
      <button type="button" class="btn-delete-todo" title="Hapus Tugas">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
    
    <div class="todo-card-body">
      <!-- Waktu Pelaksanaan -->
      <div class="todo-input-group">
        <label>Waktu Pelaksanaan</label>
        <input type="time" class="todo-input-waktu" value="${escapeHtml(waktu)}" required>
      </div>

      <!-- Judul Tugas -->
      <div class="todo-input-group">
        <label>Judul Tugas</label>
        <input type="text" class="todo-input-judul" placeholder="Tulis rencana tugas..." value="${escapeHtml(text)}" required>
      </div>

      <!-- Deskripsi Tugas -->
      <div class="todo-input-group">
        <label>Deskripsi Tugas</label>
        <textarea class="todo-input-deskripsi" rows="2" placeholder="Tulis detail/deskripsi tugas...">${escapeHtml(description)}</textarea>
      </div>

      <!-- Kendala (Opsional) -->
      <div class="todo-input-group">
        <label>Kendala / Hambatan (Opsional)</label>
        <input type="text" class="todo-input-kendala" placeholder="Tulis kendala tugas ini jika ada..." value="${escapeHtml(kendala)}">
      </div>

      <!-- Progres Bar / Slider -->
      <div class="todo-input-group todo-progress-group">
        <label>Progres Pengerjaan</label>
        <div class="todo-slider-control">
          <input type="range" class="todo-slider-progress" min="0" max="100" step="10" value="${progress}">
          <span class="progress-label ${progress === 100 ? 'completed' : ''}">${progress}%</span>
        </div>
      </div>
    </div>
  `;

  const slider = card.querySelector('.todo-slider-progress');
  const label = card.querySelector('.progress-label');

  const handleProgressChange = () => {
    const val = parseInt(slider.value, 10);
    label.textContent = `${val}%`;
    if (val === 100) {
      label.classList.add('completed');
    } else {
      label.classList.remove('completed');
    }
  };

  slider.addEventListener('input', handleProgressChange);
  slider.addEventListener('change', handleProgressChange);

  card.querySelector('.btn-delete-todo').addEventListener('click', () => {
    card.remove();
    renumberTodoRows();
  });

  todoItemsList.appendChild(card);
  renumberTodoRows();
}

function renumberTodoRows() {
  const cards = todoItemsList.querySelectorAll('.todo-item-card');
  cards.forEach((card, index) => {
    card.querySelector('.todo-num').textContent = index + 1;
  });
}

function getTodoJsonFromBuilder() {
  const cards = todoItemsList.querySelectorAll('.todo-item-card');
  const todos = [];

  cards.forEach(card => {
    const text = card.querySelector('.todo-input-judul').value.trim();
    const description = card.querySelector('.todo-input-deskripsi').value.trim();
    const kendala = card.querySelector('.todo-input-kendala').value.trim();
    const progress = parseInt(card.querySelector('.todo-slider-progress').value, 10);
    const waktu = card.querySelector('.todo-input-waktu').value;
    if (text) {
      todos.push({ text, description, kendala, progress, waktu });
    }
  });

  return JSON.stringify(todos);
}

function clearTodoBuilder() {
  todoItemsList.innerHTML = '';
  todoItemCount = 0;
  createTodoRow('', '', '', 0, '08:00');
}

function renderTodoListHtml(todoListStr) {
  if (!todoListStr) return '';

  if (todoListStr.trim().startsWith('[')) {
    try {
      const todos = JSON.parse(todoListStr);
      if (Array.isArray(todos)) {
        if (todos.length > 0) {
          return todos.map((item, idx) => {
            const hasDesc = item.description && item.description.trim() !== '';
            const hasKendala = item.kendala && item.kendala.trim() !== '';
            return `
              <div class="todo-card-item">
                <div class="todo-card-meta" style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="todo-card-text">
                    ${item.waktu ? `<span class="todo-time-badge" style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; margin-right:8px; font-size:0.8rem; font-weight:600;"><i class="fa-regular fa-clock"></i> ${escapeHtml(item.waktu)}</span>` : ''}
                    ${idx + 1}. ${escapeHtml(item.text)}
                  </span>
                  <span class="todo-card-pct ${item.progress === 100 ? 'completed' : ''}">${item.progress}%</span>
                </div>
                
                ${hasDesc ? `
                  <div class="todo-card-desc">
                    ${escapeHtml(item.description)}
                  </div>
                ` : ''}
                
                ${hasKendala ? `
                  <div class="todo-card-kendala">
                    <i class="fa-solid fa-triangle-exclamation"></i> Kendala: ${escapeHtml(item.kendala)}
                  </div>
                ` : ''}

                <div class="todo-progressbar-bg">
                  <div class="todo-progressbar-fill ${item.progress === 100 ? 'completed' : ''}" style="width: ${item.progress}%"></div>
                </div>
              </div>
            `;
          }).join('');
        } else {
          return `<div class="report-text" style="color:var(--text-muted); font-style:italic;">Tidak ada rencana kerja (To-Do) yang dicatat.</div>`;
        }
      }
    } catch (e) {
      console.error('Failed to parse todo_list JSON:', e);
    }
  }

  return `<div class="report-text">${escapeHtml(todoListStr)}</div>`;
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

// Show / Hide Loading Overlay
function showLoading(show) {
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

// Password toggle helper
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-xmark';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Trigger slide in
  setTimeout(() => toast.classList.add('show'), 10);

  // Slide out and remove
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4000);
}

// Date formatter: YYYY-MM-DD -> Indonesian Date (e.g., Selasa, 16 Juni 2026)
function formatIndonesianDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${monthName} ${year}`;
}

// Date checker
function isToday(dateStr) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  return dateStr === today;
}

// Format SQLite datetime string
function formatTimestamp(timestampStr) {
  if (!timestampStr) return '';
  // SQL timestamp is UTC, so we append Z to make JS parse it as UTC
  const isoStr = timestampStr.replace(' ', 'T') + 'Z';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return timestampStr;

  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar'
  });
  return timeStr + ' WITA';
}

// Relative time format
function formatTimeAgo(timestampStr) {
  if (!timestampStr) return '';
  const isoStr = timestampStr.replace(' ', 'T') + 'Z';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return '';

  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 5) return 'baru saja';

  const intervals = {
    tahun: 31536000,
    bulan: 2592000,
    minggu: 604800,
    hari: 86400,
    jam: 3600,
    menit: 60
  };

  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) {
      return `${count} ${unit} yang lalu`;
    }
  }

  return `${seconds} detik yang lalu`;
}

// HTML Escaper
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================================================
// NEW EMPLOYEE DASHBOARD DATA LOADERS & WIDGETS
// ==========================================================================

async function loadDashboardData() {
  if (!currentUser) return;
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = currentUser.role && adminRoles.includes(currentUser.role.toLowerCase());

  if (isAdmin) {
    await loadManagerDashboardData();
    return;
  }

  // Set Greeting & Profile details on dashboard
  if (currentUser) {
    const dashFullname = document.getElementById('dash-user-fullname');
    const dashRoleSub = document.getElementById('dash-user-role-sub');
    const dashJabatan = document.getElementById('dash-user-jabatan');
    const dashDept = document.getElementById('dash-user-departemen');
    const dashGreetingText = document.getElementById('dash-greeting-text');

    if (dashFullname) dashFullname.textContent = currentUser.nama_lengkap;

    const currentHour = new Date().getHours();
    let greeting = 'Selamat Malam';
    if (currentHour >= 4 && currentHour < 11) {
      greeting = 'Selamat Pagi';
    } else if (currentHour >= 11 && currentHour < 15) {
      greeting = 'Selamat Siang';
    } else if (currentHour >= 15 && currentHour < 19) {
      greeting = 'Selamat Sore';
    } else {
      greeting = 'Selamat Malam';
    }
    if (dashGreetingText) dashGreetingText.textContent = greeting;

    const details = getUserDetails(currentUser.role);
    if (dashRoleSub) dashRoleSub.textContent = `${details.jabatan} - ${details.departemen}`;
    if (dashJabatan) dashJabatan.textContent = details.jabatan;
    if (dashDept) dashDept.textContent = details.departemen;
  }

  // Set Current Date dynamically
  const dateEl = document.getElementById('dash-current-date');
  if (dateEl) {
    const formatted = formatIndonesianDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }));
    dateEl.textContent = formatted;
  }

  // Fetch reports
  try {
    const response = await fetch('/api/reports/my');
    if (!response.ok) throw new Error('Failed to fetch reports');

    const data = await response.json();
    const reports = data.reports || [];

    // Find today's report using local date string
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const [year, month, day] = todayStr.split('-');
    const todayReport = reports.find(r => r.tanggal === todayStr);

    let totalTasksToday = 0;
    let inProgressTasksToday = 0;
    let completedTasksToday = 0;
    let avgProgressToday = 0;

    // Process today's tasks
    const todayTasksList = document.getElementById('today-tasks-list');
    if (todayTasksList) todayTasksList.innerHTML = '';

    if (todayReport && todayReport.todo_list) {
      try {
        const todos = JSON.parse(todayReport.todo_list);
        if (Array.isArray(todos) && todos.length > 0) {
          totalTasksToday = todos.length;
          let sumProgress = 0;

          todos.forEach(todo => {
            sumProgress += todo.progress || 0;
            if (todo.progress > 0 && todo.progress < 100) {
              inProgressTasksToday++;
            } else if (todo.progress === 100) {
              completedTasksToday++;
            }

            // Render row in Pekerjaan Hari Ini
            if (todayTasksList) {
              const row = document.createElement('div');
              row.className = 'today-task-row';

              const progressVal = todo.progress || 0;
              let progressClass = '';
              if (progressVal === 100) progressClass = '';
              else if (progressVal > 0) progressClass = 'in-progress';
              else progressClass = 'not-started';

              row.innerHTML = `
                <span class="task-time">${escapeHtml(todo.waktu || '08:00')}</span>
                <span class="task-title">${escapeHtml(todo.text)}</span>
                <span class="task-progress ${progressClass}">Progress ${progressVal}%</span>
              `;
              todayTasksList.appendChild(row);
            }
          });

          avgProgressToday = Math.round(sumProgress / totalTasksToday);
        } else {
          showEmptyTodayTasksPlaceholder();
        }
      } catch (err) {
        console.error('Failed to parse today todo_list JSON:', err);
        showEmptyTodayTasksPlaceholder();
      }
    } else {
      showEmptyTodayTasksPlaceholder();
    }

    // Calculate overall and monthly stats across all reports
    let totalTasksAll = 0;
    let inProgressTasksAll = 0;
    let completedTasksAll = 0;
    let overdueTasksAll = 0;
    let totalTasksMonth = 0;
    let sumProgressMonth = 0;
    const currentMonthStr = `${year}-${month}`; // "YYYY-MM"

    reports.forEach(r => {
      if (r.todo_list) {
        try {
          const todos = JSON.parse(r.todo_list);
          if (Array.isArray(todos)) {
            todos.forEach(todo => {
              totalTasksAll++;

              if (todo.progress === 100) {
                completedTasksAll++;
              } else {
                inProgressTasksAll++;
                if (todo.deadline && todo.deadline.trim() !== '' && todo.deadline < todayStr) {
                  overdueTasksAll++;
                }
              }

              if (r.tanggal && r.tanggal.startsWith(currentMonthStr)) {
                totalTasksMonth++;
                sumProgressMonth += todo.progress || 0;
              }
            });
          }
        } catch (e) {
          console.error('Failed to parse todo_list:', e);
        }
      }
    });

    const avgProgressMonth = totalTasksMonth > 0 ? Math.round(sumProgressMonth / totalTasksMonth) : 0;

    // Update Stats Cards
    const elMyTasks = document.getElementById('stat-val-my-tasks');
    const elInProgress = document.getElementById('stat-val-in-progress');
    const elCompleted = document.getElementById('stat-val-completed');
    const elProductivity = document.getElementById('stat-val-productivity');

    if (elMyTasks) elMyTasks.textContent = totalTasksAll;
    if (elInProgress) elInProgress.textContent = inProgressTasksAll;
    if (elCompleted) elCompleted.textContent = completedTasksAll;
    if (elProductivity) elProductivity.textContent = `${avgProgressMonth}%`;

    // Dynamic Overdue Card
    const elCardOverdue = document.getElementById('stat-card-overdue');
    const elOverdue = document.getElementById('stat-val-overdue');
    if (elOverdue) elOverdue.textContent = overdueTasksAll;
    if (elCardOverdue) {
      if (overdueTasksAll > 0) {
        elCardOverdue.classList.remove('hidden');
      } else {
        elCardOverdue.classList.add('hidden');
      }
    }

  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

function showEmptyTodayTasksPlaceholder() {
  const todayTasksList = document.getElementById('today-tasks-list');
  if (todayTasksList) {
    todayTasksList.innerHTML = `
      <div style="text-align:center; padding: 20px 0; color:var(--text-muted);">
        <i class="fa-solid fa-list-check" style="font-size: 2rem; margin-bottom: 10px; color:#cbd5e1; display:block;"></i>
        <span>Belum ada pekerjaan untuk hari ini.</span>
        <button class="btn btn-secondary btn-sm" onclick="switchTab('add-report')" style="margin-top: 12px; display:inline-flex;">
          <i class="fa-solid fa-plus"></i> Buat Laporan Hari Ini
        </button>
      </div>
    `;
  }
}

async function loadTasksTabs() {
  try {
    const response = await fetch('/api/reports/my');
    if (!response.ok) throw new Error('Failed to fetch reports');

    const data = await response.json();
    const reports = data.reports || [];

    let tempTasksList = [];

    // Reverse reports to process from oldest to newest for dynamic chronological ID counters
    const reversedReports = [...reports].reverse();
    let mpeCounter = 1;
    let reqCounter = 1;
    let prjCounter = 1;
    let tskCounter = 1;

    reversedReports.forEach(report => {
      if (report.todo_list) {
        try {
          const todos = JSON.parse(report.todo_list);
          if (Array.isArray(todos)) {
            const formattedDate = formatIndonesianDate(report.tanggal);
            todos.forEach((item, itemIndex) => {
              const category = item.category || 'MPE Utama';
              let taskId = '';
              const catLower = category.trim().toLowerCase();

              if (catLower === 'mpe utama') {
                taskId = `MPE-${String(mpeCounter++).padStart(3, '0')}`;
              } else if (catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept')) {
                taskId = `REQ-${String(reqCounter++).padStart(3, '0')}`;
              } else if (catLower === 'other project' || catLower.includes('other') || catLower.includes('project')) {
                taskId = `PRJ-${String(prjCounter++).padStart(3, '0')}`;
              } else {
                taskId = `TSK-${String(tskCounter++).padStart(3, '0')}`;
              }

              // Push to global all tasks data
              tempTasksList.push({
                taskId: taskId,
                text: item.text,
                category: category,
                progress: item.progress,
                waktu: item.waktu,
                description: item.description,
                kendala: item.kendala,
                deadline: item.deadline || '',
                tanggal: report.tanggal,
                formattedDate: formattedDate,
                reportId: report.id,
                itemIndex: itemIndex
              });
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    // Store in global array (newest first for the main table)
    allMyTasksData = [...tempTasksList].reverse();

    // Default render for main table counts
    renderTasksTable();

  } catch (err) {
    console.error('Failed to load tasks list:', err);
  }
}

// Current active filter: 'inprogress' or 'done'

let currentTaskFilter = 'inprogress';

function renderTasksTable() {
  const inprogressCount = document.getElementById('mytasks-inprogress-count');
  const doneCount = document.getElementById('mytasks-done-count');

  const inProgressTasks = allMyTasksData.filter(t => t.progress < 100);
  const doneTasks = allMyTasksData.filter(t => t.progress === 100);

  if (inprogressCount) inprogressCount.textContent = inProgressTasks.length;
  if (doneCount) doneCount.textContent = doneTasks.length;
}

function filterMyTasks(filter) {
  currentTaskFilter = filter;

  // Toggle active button
  document.querySelectorAll('.mytasks-filter-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`filter-btn-${filter}`);
  if (activeBtn) activeBtn.classList.add('active');

  renderSavedActivitiesList();
}

function loadProfileData() {
  if (!currentUser) return;
  const avatarLarge = document.getElementById('profile-avatar-large');
  const fullnameLarge = document.getElementById('profile-fullname-large');
  const roleLarge = document.getElementById('profile-role-large');
  const valUsername = document.getElementById('profile-val-username');
  const valDept = document.getElementById('profile-val-dept');

  if (avatarLarge) avatarLarge.textContent = getInitials(currentUser.nama_lengkap);
  if (fullnameLarge) fullnameLarge.textContent = currentUser.nama_lengkap;

  const details = getUserDetails(currentUser.role);
  if (roleLarge) roleLarge.textContent = details.jabatan;
  if (valUsername) valUsername.textContent = `@${currentUser.username}`;
  if (valDept) valDept.textContent = details.departemen;
}

function renderCalendarWidget() {
  const container = document.getElementById('custom-calendar-widget');
  if (!container) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  let headerHtml = `
    <div class="calendar-header-widget">
      <span>${monthNames[month]} ${year}</span>
      <span style="font-size:0.8rem; color:#1d4ed8; font-weight:bold;">Bulan Ini</span>
    </div>
  `;

  let gridHtml = `<div class="calendar-grid-widget">`;
  const dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  dayHeaders.forEach(day => {
    gridHtml += `<div class="calendar-day-header">${day}</div>`;
  });

  // Empty slots before first day
  for (let i = 0; i < firstDayIndex; i++) {
    gridHtml += `<div class="calendar-day-cell empty-cell"></div>`;
  }

  const todayDate = today.getDate();
  const monthStr = String(month + 1).padStart(2, '0');

  for (let day = 1; day <= lastDay; day++) {
    const isCurrent = (day === todayDate && today.getMonth() === month && today.getFullYear() === year);
    const dayStr = String(day).padStart(2, '0');
    const cellDateStr = `${year}-${monthStr}-${dayStr}`;

    // Filter tasks matching this deadline
    const dayTasks = allMyTasksData.filter(t => t.deadline === cellDateStr);

    let cellInner = `<span class="day-number" style="font-size:1.05rem; font-weight:700;">${day}</span>`;
    if (dayTasks.length > 0) {
      const pendingTasks = dayTasks.filter(t => t.progress < 100);
      const completedTasks = dayTasks.filter(t => t.progress === 100);
      cellInner += `
        <div class="calendar-day-badges">
          ${pendingTasks.length > 0 ? `<span class="badge-dot pending" title="${pendingTasks.length} deadline aktif"></span>` : ''}
          ${completedTasks.length > 0 ? `<span class="badge-dot completed" title="${completedTasks.length} deadline selesai"></span>` : ''}
        </div>
      `;
    }

    const cellClass = isCurrent ? 'calendar-day-cell current-day' : 'calendar-day-cell';
    gridHtml += `
      <div class="${cellClass}" onclick="selectCalendarDay('${cellDateStr}', ${day})" data-date="${cellDateStr}">
        ${cellInner}
      </div>
    `;
  }

  gridHtml += `</div>`;
  container.innerHTML = headerHtml + gridHtml;

  // Clear or hide the selected day details initially
  const detailPanel = document.getElementById('calendar-day-tasks-detail');
  if (detailPanel) detailPanel.style.display = 'none';

  // Render the upcoming deadlines list
  renderUpcomingDeadlines();
}

function selectCalendarDay(dateStr, dayNum) {
  // Highlight the selected day
  document.querySelectorAll('.calendar-day-cell').forEach(cell => {
    cell.classList.remove('selected-day');
  });
  const clickedCell = document.querySelector(`.calendar-day-cell[data-date="${dateStr}"]`);
  if (clickedCell) clickedCell.classList.add('selected-day');

  const detailPanel = document.getElementById('calendar-day-tasks-detail');
  if (!detailPanel) return;

  // Filter tasks:
  // 1. Tasks that have this date as deadline
  const deadlineTasks = allMyTasksData.filter(t => t.deadline === dateStr);

  // 2. Tasks that were reported/created on this date
  const reportedTasks = allMyTasksData.filter(t => t.tanggal === dateStr);

  const formatted = formatIndonesianDate(dateStr);

  let html = `
    <h3 style="margin-bottom:15px; font-family:var(--font-display); font-weight:600; font-size:1.1rem; color:#1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom:8px; display:flex; align-items:center; gap:8px;">
      <i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i> Detail Tanggal: ${formatted}
    </h3>
  `;

  if (deadlineTasks.length === 0 && reportedTasks.length === 0) {
    html += `
      <div style="text-align:center; padding: 20px 0; color:#94a3b8;">
        <i class="fa-regular fa-calendar-minus" style="font-size: 2rem; margin-bottom: 8px; color:#cbd5e1; display:block;"></i>
        <span>Tidak ada aktivitas atau deadline pada tanggal ini.</span>
      </div>
    `;
  } else {
    if (deadlineTasks.length > 0) {
      html += `
        <h4 style="font-size:0.9rem; font-weight:600; color:#ea580c; margin-top:10px; margin-bottom:10px;"><i class="fa-regular fa-calendar-check"></i> Tenggat Waktu (Deadline)</h4>
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
      `;
      deadlineTasks.forEach(task => {
        const isCompleted = task.progress === 100;
        const progressColor = isCompleted ? '#16a34a' : (task.progress >= 50 ? '#2563eb' : '#f59e0b');
        html += `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 12px; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <span style="font-weight:600; font-size:0.9rem; color:#1e293b;">${escapeHtml(task.text)}</span>
              <span class="badge-status ${isCompleted ? 'badge-status-done' : 'badge-status-progress'}">${isCompleted ? 'Selesai' : 'In Progress'}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="background:rgba(0,0,0,0.05); height:6px; border-radius:3px; flex-grow:1; overflow:hidden;">
                <div style="width:${task.progress}%; background:${progressColor}; height:100%;"></div>
              </div>
              <span style="font-size:0.8rem; font-weight:600; color:${progressColor};">${task.progress}%</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    if (reportedTasks.length > 0) {
      html += `
        <h4 style="font-size:0.9rem; font-weight:600; color:#1e40af; margin-top:10px; margin-bottom:10px;"><i class="fa-solid fa-list-check"></i> Aktivitas Dilaporkan</h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
      `;
      reportedTasks.forEach(task => {
        const isCompleted = task.progress === 100;
        const progressColor = isCompleted ? '#16a34a' : (task.progress >= 50 ? '#2563eb' : '#f59e0b');
        html += `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 12px; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <span style="font-weight:600; font-size:0.9rem; color:#1e293b;">${escapeHtml(task.text)}</span>
              <span class="badge-status ${isCompleted ? 'badge-status-done' : 'badge-status-progress'}">${isCompleted ? 'Selesai' : 'In Progress'}</span>
            </div>
            ${task.waktu ? `<span style="font-size:0.75rem; color:#64748b;"><i class="fa-regular fa-clock"></i> Jam: ${escapeHtml(task.waktu)}</span>` : ''}
          </div>
        `;
      });
      html += `</div>`;
    }
  }

  detailPanel.innerHTML = html;
  detailPanel.style.display = 'block';
}

function renderUpcomingDeadlines() {
  const container = document.getElementById('calendar-upcoming-deadlines');
  if (!container) return;

  // Filter tasks with deadlines that are NOT complete
  const activeDeadlines = allMyTasksData.filter(t => t.deadline && t.progress < 100);

  let html = `
    <h3 style="margin-bottom:15px; font-family:var(--font-display); font-weight:600; font-size:1.1rem; color:#1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom:8px; display:flex; align-items:center; gap:8px;">
      <i class="fa-solid fa-bell" style="color:#f59e0b;"></i> Daftar Tenggat Waktu Terdekat (${activeDeadlines.length})
    </h3>
  `;

  if (activeDeadlines.length === 0) {
    html += `
      <div style="text-align:center; padding: 30px 0; color:#94a3b8;">
        <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; margin-bottom: 10px; color:#16a34a; display:block;"></i>
        <span>Luar biasa! Tidak ada tenggat waktu pekerjaan aktif.</span>
      </div>
    `;
    container.innerHTML = html;
    return;
  }

  // Sort chronologically by deadline date
  const sortedDeadlines = [...activeDeadlines].sort((a, b) => {
    return new Date(a.deadline) - new Date(b.deadline);
  });

  html += `<div class="calendar-deadline-list">`;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
  const today = new Date(todayStr);

  sortedDeadlines.forEach(task => {
    const deadlineDate = new Date(task.deadline);
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let badgeClass = 'upcoming';
    let badgeText = '';

    if (diffDays < 0) {
      badgeClass = 'overdue';
      badgeText = `Terlambat ${Math.abs(diffDays)} hari`;
    } else if (diffDays === 0) {
      badgeClass = 'today';
      badgeText = 'Hari Ini';
    } else if (diffDays === 1) {
      badgeClass = 'tomorrow';
      badgeText = 'Besok';
    } else {
      badgeClass = 'upcoming';
      badgeText = `${diffDays} hari lagi`;
    }

    const formattedDate = formatIndonesianDate(task.deadline);

    html += `
      <div class="calendar-deadline-item">
        <div class="calendar-deadline-info">
          <span class="calendar-deadline-title">${escapeHtml(task.text)}</span>
          <div class="calendar-deadline-meta">
            <span><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
            <span style="color:#e2e8f0;">•</span>
            <span style="font-weight:550; color:#1d4ed8;">${escapeHtml(task.category || 'MPE Utama')}</span>
          </div>
        </div>
        <div>
          <span class="deadline-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

window.selectCalendarDay = selectCalendarDay;
window.renderUpcomingDeadlines = renderUpcomingDeadlines;

// ==========================================================================
// REDESIGNED DAILY ACTIVITY WIDGETS & SAVED LIST LOGIC
// ==========================================================================

async function loadSavedActivitiesForDate(date) {
  // Reset active variables
  currentReportId = null;
  currentTasksForDate = [];

  try {
    const response = await fetch('/api/reports/my');
    if (!response.ok) throw new Error('Failed to fetch reports');

    const data = await response.json();
    const reports = data.reports || [];

    const report = reports.find(r => r.tanggal === date);

    if (report && report.todo_list) {
      currentReportId = report.id;
      try {
        currentTasksForDate = JSON.parse(report.todo_list);
      } catch (e) {
        currentTasksForDate = [];
      }
    }
  } catch (err) {
    console.error('Failed to load saved activities:', err);
  }
  renderSavedActivitiesForDate();
}

function renderSavedActivitiesForDate() {
  const section = document.getElementById('saved-activities-section');
  const container = document.getElementById('saved-activities-list-container');
  if (!section || !container) return;

  if (currentTasksForDate.length === 0) {
    section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  section.classList.remove('hidden');
  container.innerHTML = '';

  const date = document.getElementById('report-date').value;

  currentTasksForDate.forEach((task, index) => {
    const isCompleted = task.progress === 100;
    let typeBadgeClass = 'type-badge-mpe';
    if (task.category === 'Request Dept. Lain') typeBadgeClass = 'type-badge-req';
    else if (task.category === 'Other Project') typeBadgeClass = 'type-badge-other';

    const progressColor = isCompleted ? '#16a34a' : (task.progress >= 50 ? '#2563eb' : '#f59e0b');
    const hasDesc = task.description && task.description.trim() !== '';
    const hasKendala = task.kendala && task.kendala.trim() !== '';
    const safeText = encodeURIComponent(task.text || '');
    const safeDesc = encodeURIComponent(task.description || '');
    const safeKendala = encodeURIComponent(task.kendala || '');

    const card = document.createElement('div');
    card.className = `mytask-card ${isCompleted ? 'mytask-card-done' : 'mytask-card-progress'}`;
    card.style.marginBottom = '15px';

    card.innerHTML = `
      <div class="mytask-card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div class="mytask-card-left" style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
          ${task.waktu ? `<span class="todo-time-badge" style="background:rgba(0,0,0,0.05); color:#475569; padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:600;"><i class="fa-regular fa-clock"></i> ${escapeHtml(task.waktu)}</span>` : ''}
          <span class="mytask-title" style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(task.text)}</span>
        </div>
        <div class="mytask-card-right" style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
          <span class="type-badge ${typeBadgeClass}" style="min-width: unset; padding: 2px 8px; font-size: 0.75rem;">${escapeHtml(task.category || 'MPE Utama')}</span>
          <button type="button" class="btn-edit-progress btn-act-edit"
            data-report-id="${currentReportId}"
            data-item-index="${index}"
            data-text="${safeText}"
            data-progress="${task.progress}"
            data-description="${safeDesc}"
            data-kendala="${safeKendala}"
            data-deadline="${task.deadline || ''}"
            style="padding: 4px 10px; font-size: 0.8rem; margin:0;"
            title="Edit Task">
            <i class="fa-solid fa-pen-to-square"></i> Edit
          </button>
          <button type="button" class="btn-act-delete" onclick="deleteActivityByDateAndIndex('${date}', ${index})" style="padding: 4px 10px; font-size: 0.8rem; margin:0;">
            <i class="fa-solid fa-trash-can"></i> Hapus
          </button>
        </div>
      </div>
      ${hasDesc ? `<div class="mytask-desc" style="margin-top: 8px; color: #64748b; font-size: 0.85rem;">${escapeHtml(task.description)}</div>` : ''}
      ${hasKendala ? `<div class="mytask-kendala" style="margin-top: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #b45309; font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; display: inline-block;"><i class="fa-solid fa-triangle-exclamation"></i> Kendala: ${escapeHtml(task.kendala)}</div>` : ''}
      
      <div class="mytask-footer" style="margin-top: 10px; display: flex; align-items: center; justify-content: flex-end; gap: 15px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
        <div class="mytask-progress-row" style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
          <div class="mytask-progress-bg" style="background: #e2e8f0; height: 6px; border-radius: 3px; flex-grow: 1; overflow: hidden;">
            <div class="mytask-progress-fill" style="width: ${task.progress || 0}%; background: ${progressColor}; height: 100%;"></div>
          </div>
          <span class="mytask-progress-pct" style="color: ${progressColor}; font-weight: 600; font-size: 0.8rem; min-width: 30px; text-align: right;">${task.progress || 0}%</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderSavedActivitiesList() {
  const container = document.getElementById('open-tasks-list-full');
  if (!container) return;

  const inprogressCount = document.getElementById('mytasks-inprogress-count');
  const doneCount = document.getElementById('mytasks-done-count');

  // Count progress for ALL tasks
  const inProgressTasks = allMyTasksData.filter(t => t.progress < 100);
  const doneTasks = allMyTasksData.filter(t => t.progress === 100);

  if (inprogressCount) inprogressCount.textContent = inProgressTasks.length;
  if (doneCount) doneCount.textContent = doneTasks.length;

  if (allMyTasksData.length === 0) {
    container.innerHTML = `
      <div class="tasks-empty-state" style="text-align:center; padding: 30px; color:#94a3b8; background: #1f2937; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
        <i class="fa-solid fa-list-check" style="font-size: 2rem; margin-bottom: 10px; color:#cbd5e1; display:block;"></i>
        <span>Belum ada pekerjaan harian yang terdaftar.</span>
      </div>
    `;
    return;
  }

  // Filter tasks based on selected tab
  const filteredTasks = currentTaskFilter === 'done' ? doneTasks : inProgressTasks;

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="tasks-empty-state" style="text-align:center; padding: 30px; color:#94a3b8; background: #1f2937; border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
        <i class="fa-solid ${currentTaskFilter === 'done' ? 'fa-list-check' : 'fa-circle-check'}" style="font-size: 2rem; margin-bottom: 10px; color:#cbd5e1; display:block;"></i>
        <span>${currentTaskFilter === 'done' ? 'Belum ada tugas yang selesai.' : 'Semua tugas sudah selesai! 🎉'}</span>
      </div>
    `;
    return;
  }

  let html = `
    <h4 style="margin-bottom: 15px; font-family: var(--font-display); font-weight:600;"><i class="fa-solid fa-list-check"></i> Daftar Pekerjaan (${filteredTasks.length})</h4>
    <div class="saved-activities-list">
  `;

  filteredTasks.forEach((task) => {
    const isCompleted = task.progress === 100;
    let typeBadgeClass = 'type-badge-mpe';
    if (task.category === 'Request Dept. Lain') typeBadgeClass = 'type-badge-req';
    else if (task.category === 'Other Project') typeBadgeClass = 'type-badge-other';

    const progressColor = isCompleted ? '#16a34a' : (task.progress >= 50 ? '#2563eb' : '#f59e0b');
    const hasDesc = task.description && task.description.trim() !== '';
    const hasKendala = task.kendala && task.kendala.trim() !== '';
    const safeText = encodeURIComponent(task.text || '');
    const safeDesc = encodeURIComponent(task.description || '');
    const safeKendala = encodeURIComponent(task.kendala || '');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isOverdue = !isCompleted && task.deadline && task.deadline < todayStr;

    html += `
      <div class="mytask-card ${isCompleted ? 'mytask-card-done' : 'mytask-card-progress'}" style="margin-bottom: 15px; ${isOverdue ? 'border: 1.5px solid rgba(239, 68, 68, 0.45); box-shadow: 0 0 12px rgba(239, 68, 68, 0.08);' : ''}">
        <div class="mytask-card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div class="mytask-card-left" style="display: flex; align-items: center; gap: 10px;">
            ${task.waktu ? `<span class="todo-time-badge" style="background:rgba(255,255,255,0.05); color:var(--text-main); padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:600;"><i class="fa-regular fa-clock"></i> ${escapeHtml(task.waktu)}</span>` : ''}
            <span class="mytask-title" style="font-weight:600;">${escapeHtml(task.text)}</span>
          </div>
          <div class="mytask-card-right" style="display: flex; gap: 8px; align-items: center;">
            ${isOverdue ? `
              <span class="badge-status-overdue" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-circle-exclamation"></i> Overdue
              </span>
            ` : ''}
            <span class="type-badge ${typeBadgeClass}">${escapeHtml(task.category || 'MPE Utama')}</span>
            <button type="button" class="btn-edit-progress btn-act-edit"
              data-report-id="${task.reportId}"
              data-item-index="${task.itemIndex}"
              data-text="${safeText}"
              data-progress="${task.progress}"
              data-description="${safeDesc}"
              data-kendala="${safeKendala}"
              data-deadline="${task.deadline || ''}"
              style="padding: 4px 10px; font-size: 0.8rem; margin:0;"
              title="Edit Task">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            ${currentTaskFilter === 'done' ? `
              <button type="button" class="btn-act-delete" onclick="deleteActivityByDateAndIndex('${task.tanggal}', ${task.itemIndex})" style="padding: 4px 10px; font-size: 0.8rem; margin:0;"><i class="fa-solid fa-trash-can"></i> Hapus</button>
            ` : ''}
          </div>
        </div>
        ${hasDesc ? `<div class="mytask-desc" style="margin-top: 8px; color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(task.description)}</div>` : ''}
        ${hasKendala ? `<div class="mytask-kendala" style="margin-top: 8px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 0.85rem; padding: 4px 8px; border-radius: 4px; display: inline-block;"><i class="fa-solid fa-triangle-exclamation"></i> Kendala: ${escapeHtml(task.kendala)}</div>` : ''}
        
        <!-- Tanggal Tugas & Deadline -->
        <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-dark); display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <i class="fa-regular fa-calendar"></i>
            <span style="font-weight: 500;">Tanggal: ${task.formattedDate}</span>
          </div>
          ${task.deadline ? `
            <div style="display: flex; align-items: center; gap: 6px; color:${isOverdue ? '#ef4444' : '#f59e0b'};">
              <i class="fa-regular fa-calendar-check"></i>
              <span style="font-weight: 550;">Deadline: ${formatIndonesianDate(task.deadline)}</span>
            </div>
          ` : ''}
        </div>

        <div class="mytask-footer" style="margin-top: 12px; display: flex; align-items: center; justify-content: flex-end; gap: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <div class="mytask-progress-row" style="display: flex; align-items: center; gap: 10px; flex-grow: 1;">
            <div class="mytask-progress-bg" style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; flex-grow: 1; overflow: hidden;">
              <div class="mytask-progress-fill" style="width: ${task.progress || 0}%; background: ${progressColor}; height: 100%;"></div>
            </div>
            <span class="mytask-progress-pct" style="color: ${progressColor}; font-weight: 600; font-size: 0.85rem; min-width: 35px; text-align: right;">${task.progress || 0}%</span>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

function filterCategoryTasks(filterCategory, btnEl) {
  // Update active state of buttons
  const buttons = document.querySelectorAll('.mytasks-filter-tabs .mytasks-tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  renderMyTasksTable(filterCategory);
}

function renderMyTasksTable(filterCategory) {
  const tbody = document.getElementById('mytasks-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const filter = (filterCategory || 'semua').trim().toLowerCase();

  // Filter tasks based on selected category
  let filteredTasks = allMyTasksData;
  if (filter !== 'semua') {
    filteredTasks = allMyTasksData.filter(task => {
      const cat = (task.category || 'MPE Utama').trim().toLowerCase();
      if (filter === 'mpe utama') {
        return cat === 'mpe utama';
      } else if (filter === 'request dept. lain') {
        return cat === 'request dept. lain' || cat.includes('request') || cat.includes('dept');
      } else if (filter === 'other project') {
        return cat === 'other project' || cat.includes('other') || cat.includes('project');
      }
      return false;
    });
  }

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-dark); padding: 30px; font-weight: 500;">
          <i class="fa-regular fa-folder-open" style="margin-right: 8px;"></i> Tidak ada pekerjaan dalam kategori ini.
        </td>
      </tr>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const isCompleted = task.progress === 100;
    const progressColor = isCompleted ? '#16a34a' : (task.progress >= 50 ? '#2563eb' : '#f59e0b');

    // Determine category badge class
    let typeBadgeClass = 'badge-type-mpe';
    let typeLabel = 'MPE Utama';
    const catLower = (task.category || 'MPE Utama').trim().toLowerCase();

    if (catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept')) {
      typeBadgeClass = 'badge-type-req';
      typeLabel = 'Request Dept.';
    } else if (catLower === 'other project' || catLower.includes('other') || catLower.includes('project')) {
      typeBadgeClass = 'badge-type-prj';
      typeLabel = 'Other Project';
    }

    const rowHtml = `
      <tr>
        <td style="font-family: var(--font-display); font-weight: 700; letter-spacing: 0.5px;">${escapeHtml(task.taskId)}</td>
        <td style="font-weight: 600; text-align: left;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span>${escapeHtml(task.text)}</span>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              ${task.waktu ? `<span style="font-size:0.75rem; color:var(--text-dark); font-weight:550;"><i class="fa-regular fa-clock"></i> ${escapeHtml(task.waktu)}</span>` : ''}
              ${task.deadline ? `<span style="font-size:0.75rem; color:#f59e0b; font-weight:550;"><i class="fa-regular fa-calendar-check"></i> Deadline: ${formatIndonesianDate(task.deadline)}</span>` : ''}
            </div>
          </div>
        </td>
        <td>
          <span class="badge-type ${typeBadgeClass}">${typeLabel}</span>
        </td>
        <td>
          <div class="mytasks-progress-cell">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${task.progress}%; background: ${progressColor};"></div>
            </div>
            <span class="progress-pct" style="color: ${progressColor};">${task.progress}%</span>
          </div>
        </td>
        <td>
          <span class="badge-status ${isCompleted ? 'badge-status-done' : 'badge-status-progress'}">
            ${isCompleted ? 'Selesai' : 'In Progress'}
          </span>
        </td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', rowHtml);
  });
}

async function editActivityByDateAndIndex(date, itemIndex) {
  showLoading(true);
  try {
    const reportDateInput = document.getElementById('report-date');
    if (reportDateInput) reportDateInput.value = date;

    await loadSavedActivitiesForDate(date);
    editActivity(itemIndex);
  } catch (err) {
    console.error('Failed to edit activity:', err);
    showToast('Gagal memuat aktivitas untuk diedit.', 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteActivityByDateAndIndex(date, itemIndex) {
  if (!confirm('Apakah Anda yakin ingin menghapus aktivitas ini?')) return;

  showLoading(true);
  try {
    // Fetch all reports to find the one for this date
    const response = await fetch('/api/reports/my');
    if (!response.ok) throw new Error('Gagal mengambil data laporan');
    const data = await response.json();
    const reports = data.reports || [];
    const report = reports.find(r => r.tanggal === date);
    if (!report) {
      showToast('Laporan untuk tanggal ini tidak ditemukan.', 'error');
      return;
    }

    let todos = [];
    try {
      todos = JSON.parse(report.todo_list);
    } catch (e) {
      showToast('Gagal membaca data tugas.', 'error');
      return;
    }

    if (itemIndex < 0 || itemIndex >= todos.length) {
      showToast('Tugas tidak ditemukan.', 'error');
      return;
    }

    // Remove the task
    todos.splice(itemIndex, 1);

    if (todos.length === 0) {
      // Delete the entire report if empty
      const deleteRes = await fetch(`/api/reports/${report.id}`, {
        method: 'DELETE'
      });
      const deleteData = await deleteRes.json();
      if (deleteRes.ok) {
        showToast('Aktivitas berhasil dihapus dan laporan dibersihkan!', 'success');
        await loadTasksTabs();
        renderSavedActivitiesList();
        await loadDashboardData();
        if (currentTab === 'add-report') {
          await loadSavedActivitiesForDate(date);
        }
      } else {
        showToast(deleteData.error || 'Gagal menghapus laporan.', 'error');
      }
      return;
    }

    // Recalculate done_list and kendala
    const doneItems = todos.filter(t => t.progress === 100).map((t, i) => `${i + 1}. ${t.text}`);
    const done_list = doneItems.join('\n');
    const reportKendala = todos.filter(t => t.kendala).map(t => t.kendala).join('; ');

    const updateRes = await fetch(`/api/reports/${report.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tanggal: date,
        todo_list: JSON.stringify(todos),
        done_list: done_list,
        kendala: reportKendala
      })
    });

    const updateData = await updateRes.json();
    if (updateRes.ok) {
      showToast('Aktivitas berhasil dihapus!', 'success');
      await loadTasksTabs();
      renderSavedActivitiesList();
      await loadDashboardData();
      if (currentTab === 'add-report') {
        await loadSavedActivitiesForDate(date);
      }
    } else {
      showToast(updateData.error || 'Gagal menghapus aktivitas.', 'error');
    }
  } catch (err) {
    console.error('Failed to delete activity:', err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}

function resetActivityFormOnly() {
  editingActivityIndex = null;

  // Reset text input
  const titleInput = document.getElementById('task-title-input');
  if (titleInput) titleInput.value = '';

  // Reset textarea
  document.getElementById('task-description').value = '';
  document.getElementById('task-kendala-textarea').value = '';

  // Reset slider
  document.getElementById('task-progress-range').value = 0;
  document.getElementById('task-progress-val').textContent = '0%';

  // Reset toggle switch
  const lanjutBesokCheckbox = document.getElementById('task-lanjut-besok');
  if (lanjutBesokCheckbox) lanjutBesokCheckbox.checked = false;
  const toggleStateLabel = document.getElementById('toggle-state-label');
  if (toggleStateLabel) toggleStateLabel.textContent = 'Tidak';

  // Reset category
  const categoryInput = document.getElementById('task-category');
  if (categoryInput) categoryInput.value = 'MPE Utama';

  const categoryPills = document.querySelectorAll('#task-category-pills .category-pill');
  categoryPills.forEach(p => {
    const pCat = (p.getAttribute('data-category') || '').trim().toLowerCase();
    if (pCat === 'mpe utama') {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Reset deadline
  const deadlineInput = document.getElementById('task-deadline');
  if (deadlineInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    deadlineInput.value = `${year}-${month}-${day}`;
  }

  // Reset time input to current actual time
  const timeInput = document.getElementById('task-time-input');
  if (timeInput) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeInput.value = `${hours}:${minutes}`;
  }

  // Reset submit button text
  const submitBtnText = document.querySelector('#btn-submit-activity span');
  if (submitBtnText) submitBtnText.textContent = 'Simpan Activity';
}

function editActivity(index) {
  const task = currentTasksForDate[index];
  if (!task) return;

  editingActivityIndex = index;

  // Switch to Daily Activity tab to show the edit form
  switchTab('add-report', true);

  // Set category
  const categoryVal = (task.category || 'MPE Utama').trim().toLowerCase();
  const categoryInput = document.getElementById('task-category');
  if (categoryInput) categoryInput.value = task.category || 'MPE Utama';

  const categoryPills = document.querySelectorAll('#task-category-pills .category-pill');
  categoryPills.forEach(p => {
    const pCat = (p.getAttribute('data-category') || '').trim().toLowerCase();
    if (pCat === categoryVal) {
      p.classList.add('active');
    } else {
      p.classList.remove('active');
    }
  });

  // Set time
  document.getElementById('task-time-input').value = task.waktu || '08:30';

  // Set title input
  const titleInput = document.getElementById('task-title-input');
  if (titleInput) titleInput.value = task.text || '';

  // Set description & kendala
  document.getElementById('task-description').value = task.description || '';
  document.getElementById('task-kendala-textarea').value = task.kendala || '';

  // Set deadline
  const deadlineInput = document.getElementById('task-deadline');
  if (deadlineInput) {
    deadlineInput.value = task.deadline || '';
  }

  // Set progress slider
  document.getElementById('task-progress-range').value = task.progress || 0;
  document.getElementById('task-progress-val').textContent = `${task.progress || 0}%`;

  // Set lanjut besok toggle
  const lanjutBesokCheckbox = document.getElementById('task-lanjut-besok');
  if (lanjutBesokCheckbox) lanjutBesokCheckbox.checked = task.lanjutBesok || false;
  const toggleStateLabel = document.getElementById('toggle-state-label');
  if (toggleStateLabel) toggleStateLabel.textContent = task.lanjutBesok ? 'Ya' : 'Tidak';

  // Set submit button text
  const submitBtnText = document.querySelector('#btn-submit-activity span');
  if (submitBtnText) submitBtnText.textContent = 'Simpan Perubahan Activity';

  // Smooth scroll to form card
  const card = document.querySelector('.activity-form-card');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function deleteActivity(index) {
  if (!confirm('Apakah Anda yakin ingin menghapus aktivitas ini?')) return;

  const tanggal = document.getElementById('report-date').value;
  showLoading(true);

  try {
    let updatedTasks = [...currentTasksForDate];
    updatedTasks.splice(index, 1);

    if (updatedTasks.length === 0) {
      // Delete the entire report if empty
      const response = await fetch(`/api/reports/${currentReportId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok) {
        showToast('Aktivitas berhasil dihapus dan laporan dibersihkan!', 'success');
        resetActivityFormOnly();
        await loadSavedActivitiesForDate(tanggal);
        await loadTasksTabs();
        loadDashboardData();
      } else {
        showToast(data.error || 'Gagal menghapus laporan.', 'error');
      }
      return;
    }

    const todo_list = JSON.stringify(updatedTasks);

    // Done list
    const doneItems = [];
    updatedTasks.forEach(t => {
      if (t.progress === 100) {
        doneItems.push(t.text);
      }
    });
    const done_list = doneItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n');

    // Kendala
    const kendalaItems = [];
    updatedTasks.forEach(t => {
      if (t.kendala) {
        kendalaItems.push(t.kendala);
      }
    });
    const reportKendala = kendalaItems.join('; ');

    const url = `/api/reports/${currentReportId}`;
    const method = 'PUT';

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tanggal, todo_list, done_list, kendala: reportKendala })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Aktivitas berhasil dihapus!', 'success');
      resetActivityFormOnly();
      await loadSavedActivitiesForDate(tanggal);
      await loadTasksTabs();
      loadDashboardData();
    } else {
      showToast(data.error || 'Gagal menghapus aktivitas.', 'error');
    }
  } catch (err) {
    console.error('Failed to delete activity:', err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}

window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.editActivityByDateAndIndex = editActivityByDateAndIndex;
window.deleteActivityByDateAndIndex = deleteActivityByDateAndIndex;

// ==========================================================================
// UPDATE PROGRESS — OPEN TASKS
// ==========================================================================

function openUpdateProgressModal(reportId, itemIndex, taskText, currentProgress, description, kendala, deadline) {
  const modal = document.getElementById('modal-update-progress');
  if (!modal) return;

  document.getElementById('modal-task-title').value = taskText || '';
  document.getElementById('modal-task-desc').value = description || '';
  document.getElementById('modal-task-kendala').value = kendala || '';

  const deadlineInput = document.getElementById('modal-task-deadline');
  if (deadlineInput) {
    deadlineInput.value = deadline || '';
  }

  const slider = document.getElementById('modal-progress-slider');
  slider.value = currentProgress;
  slider.style.setProperty('--progress-pct', currentProgress + '%');

  document.getElementById('modal-progress-display').textContent = currentProgress + '%';
  document.getElementById('modal-report-id').value = reportId;
  document.getElementById('modal-item-index').value = itemIndex;

  modal.classList.add('show');
}

function closeUpdateProgressModal() {
  const modal = document.getElementById('modal-update-progress');
  if (modal) modal.classList.remove('show');
}

async function saveUpdatedProgress() {
  const reportId = document.getElementById('modal-report-id').value;
  const itemIndex = parseInt(document.getElementById('modal-item-index').value);
  const newProgress = parseInt(document.getElementById('modal-progress-slider').value);
  const newTitle = document.getElementById('modal-task-title').value.trim();
  const newDesc = document.getElementById('modal-task-desc').value.trim();
  const newKendala = document.getElementById('modal-task-kendala').value.trim();
  const newDeadline = document.getElementById('modal-task-deadline').value;
  const btn = document.getElementById('btn-save-progress');

  if (!reportId || !newTitle) {
    showToast('Judul task tidak boleh kosong!', 'error');
    return;
  }

  if (!newDeadline) {
    showToast('Deadline wajib diisi!', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

  try {
    // Fetch the current report
    const res = await fetch(`/api/reports/${reportId}`);
    if (!res.ok) throw new Error('Gagal mengambil data laporan');
    const { report } = await res.json();

    // Parse & update the specific todo item
    const todos = JSON.parse(report.todo_list);
    if (!Array.isArray(todos) || todos[itemIndex] === undefined) throw new Error('Item tidak ditemukan');

    todos[itemIndex].text = newTitle;
    todos[itemIndex].description = newDesc;
    todos[itemIndex].kendala = newKendala;
    todos[itemIndex].progress = newProgress;
    todos[itemIndex].deadline = newDeadline;

    // Done list
    const doneItems = [];
    todos.forEach(t => {
      if (t.progress === 100) {
        doneItems.push(t.text);
      }
    });
    const done_list = doneItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n');

    // Kendala
    const kendalaItems = [];
    todos.forEach(t => {
      if (t.kendala) {
        kendalaItems.push(t.kendala);
      }
    });
    const reportKendala = kendalaItems.join('; ');

    // PUT updated report back
    const updateRes = await fetch(`/api/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tanggal: report.tanggal,
        todo_list: JSON.stringify(todos),
        done_list: done_list,
        kendala: reportKendala
      })
    });

    if (!updateRes.ok) throw new Error('Gagal menyimpan perubahan');

    showToast('Task berhasil diperbarui!', 'success');
    closeUpdateProgressModal();

    // Reload tasks to reflect changes
    await loadTasksTabs();
    renderSavedActivitiesList();
    await loadDashboardData();
    if (currentTab === 'add-report') {
      await loadSavedActivitiesForDate(report.tanggal);
    }

  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan. Coba lagi.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
  }
}

// (Event delegation is handled by the full click handler below at end of file)


// ==========================================================================
// MANAGER DASHBOARD GLOBAL STATE & WIDGETS
// ==========================================================================
let allManagerTasksData = [];
let managerEmployeesList = [];
let chartTeamProgressInstance = null;
let chartJobTypesInstance = null;

// A. Main Manager Dashboard Loader
async function loadManagerDashboardData() {
  const deptFilter = document.getElementById('filter-manager-dept');
  const picFilter = document.getElementById('filter-manager-pic');
  const dateFilter = document.getElementById('filter-manager-date');

  try {
    // 1. Fetch Employees
    const empRes = await fetch('/api/employees');
    if (!empRes.ok) throw new Error('Gagal mengambil daftar karyawan');
    const empData = await empRes.json();
    managerEmployeesList = empData.employees || [];

    // 2. Fetch All Reports Feed
    const feedRes = await fetch('/api/reports/feed');
    if (!feedRes.ok) throw new Error('Gagal mengambil data timeline reports');
    const feedData = await feedRes.json();
    const feedReports = feedData.feed || [];

    // 3. Parse all reports into task level data points
    allManagerTasksData = [];
    let taskCounter = 1;
    let mpeCounter = 1;
    let reqCounter = 1;
    let prjCounter = 1;

    // Process from oldest to newest for chronological index counts
    const reversedFeed = [...feedReports].reverse();

    reversedFeed.forEach(report => {
      if (report.todo_list) {
        try {
          const todos = JSON.parse(report.todo_list);
          if (Array.isArray(todos)) {
            todos.forEach((todo, idx) => {
              const category = todo.category || 'MPE Utama';
              let taskId = '';
              const catLower = category.trim().toLowerCase();

              if (catLower === 'mpe utama') {
                taskId = `MPE-${String(mpeCounter++).padStart(3, '0')}`;
              } else if (catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept')) {
                taskId = `REQ-${String(reqCounter++).padStart(3, '0')}`;
              } else if (catLower === 'other project' || catLower.includes('other') || catLower.includes('project')) {
                taskId = `PRJ-${String(prjCounter++).padStart(3, '0')}`;
              } else {
                taskId = `TSK-${String(taskCounter++).padStart(3, '0')}`;
              }

              // Determine user department by user role
              const empInfo = managerEmployeesList.find(e => e.id === report.user_id);
              const userRole = report.role || (empInfo ? empInfo.role : 'foreman');
              const details = getUserDetails(userRole);

              allManagerTasksData.push({
                taskId: taskId,
                text: todo.text,
                description: todo.description || '',
                category: category,
                progress: todo.progress || 0,
                waktu: todo.waktu || '08:00',
                kendala: todo.kendala || '',
                deadline: todo.deadline || '',
                tanggal: report.tanggal,
                picId: report.user_id,
                picName: report.nama_lengkap,
                username: report.username,
                dept: details.departemen,
                reportId: report.id,
                itemIndex: idx
              });
            });
          }
        } catch (e) {
          console.error('JSON parse error in report:', e);
        }
      }
    });

    // Reverse back so that newest data is first
    allManagerTasksData.reverse();

    // 4. Populate filters
    populateManagerFilters();

    // 5. Apply filters & Draw Dashboard widgets
    applyManagerDashboardFilters();

    // 6. Bind change events (ensure once only)
    if (deptFilter && !deptFilter.dataset.bound) {
      deptFilter.addEventListener('change', applyManagerDashboardFilters);
      deptFilter.dataset.bound = 'true';
    }
    if (picFilter && !picFilter.dataset.bound) {
      picFilter.addEventListener('change', applyManagerDashboardFilters);
      picFilter.dataset.bound = 'true';
    }
    if (dateFilter && !dateFilter.dataset.bound) {
      dateFilter.addEventListener('change', applyManagerDashboardFilters);
      dateFilter.dataset.bound = 'true';
    }

  } catch (err) {
    console.error('Error loading manager dashboard data:', err);
    showToast('Terjadi kesalahan memuat dashboard manager.', 'error');
  }
}

// B. Populate Dropdown Options
function populateManagerFilters() {
  const picFilter = document.getElementById('filter-manager-pic');
  const dateFilter = document.getElementById('filter-manager-date');

  if (picFilter) {
    // Keep the default "Semua PIC" option
    picFilter.innerHTML = '<option value="semua">Semua PIC</option>';
    managerEmployeesList.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;
      option.textContent = emp.nama_lengkap;
      picFilter.appendChild(option);
    });
  }

  if (dateFilter) {
    // Keep default "Semua Waktu"
    dateFilter.innerHTML = '<option value="semua">Semua Waktu</option>';

    // Get unique months from tasks
    const monthsSet = new Set();
    allManagerTasksData.forEach(task => {
      if (task.tanggal) {
        const parts = task.tanggal.split('-'); // YYYY-MM-DD
        if (parts.length >= 2) {
          monthsSet.add(`${parts[0]}-${parts[1]}`); // "YYYY-MM"
        }
      }
    });

    // Convert to sorted array
    const sortedMonths = Array.from(monthsSet).sort().reverse();
    const indonesianMonths = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    sortedMonths.forEach(ym => {
      const [year, month] = ym.split('-');
      const monthIndex = parseInt(month, 10) - 1;
      const label = `${indonesianMonths[monthIndex]} ${year}`;

      const option = document.createElement('option');
      option.value = ym;
      option.textContent = label;

      // Auto select current month if applicable
      const now = new Date();
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (ym === currentYM) {
        option.selected = true;
      }

      dateFilter.appendChild(option);
    });
  }
}

// C. Filter tasks and update Stats, Charts, and Table
function applyManagerDashboardFilters() {
  const selectedDept = document.getElementById('filter-manager-dept').value;
  const selectedPic = document.getElementById('filter-manager-pic').value;
  const selectedMonth = document.getElementById('filter-manager-date').value;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });

  // Filter tasks list
  const filteredTasks = allManagerTasksData.filter(task => {
    // 1. Dept filter
    if (selectedDept !== 'semua' && task.dept !== selectedDept) return false;

    // 2. PIC filter
    if (selectedPic !== 'semua' && String(task.picId) !== String(selectedPic)) return false;

    // 3. Month filter
    if (selectedMonth !== 'semua') {
      const parts = task.tanggal.split('-');
      const taskYM = `${parts[0]}-${parts[1]}`;
      if (taskYM !== selectedMonth) return false;
    }

    return true;
  });

  // Calculate Stats
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.progress === 100).length;
  const inProgressTasks = filteredTasks.filter(t => t.progress > 0 && t.progress < 100).length;
  const overdueTasks = filteredTasks.filter(t => t.progress < 100 && t.deadline && t.deadline < todayStr).length;

  let sumProgress = 0;
  filteredTasks.forEach(t => sumProgress += t.progress);
  const avgProgress = totalTasks > 0 ? Math.round(sumProgress / totalTasks) : 0;
  const selesaiPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Render Stats
  document.getElementById('m-val-total-task').textContent = totalTasks;
  document.getElementById('m-val-selesai').textContent = completedTasks;
  document.getElementById('m-val-selesai-pct').textContent = `(${selesaiPct}%)`;
  document.getElementById('m-val-inprogress').textContent = inProgressTasks;
  document.getElementById('m-val-overdue').textContent = overdueTasks;
  document.getElementById('m-val-avg-progress').textContent = `${avgProgress}%`;

  // Draw Charts
  drawManagerCharts(filteredTasks);

  // Render Overdue Table
  renderManagerOverdueTable(filteredTasks, todayStr);
}

// D. Render Overdue Tasks Table
function renderManagerOverdueTable(tasks, todayStr) {
  const tbody = document.getElementById('manager-overdue-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const overdueTasks = tasks.filter(t => t.progress < 100 && t.deadline && t.deadline < todayStr);

  if (overdueTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-dark); padding: 30px; font-weight: 600;">
          <i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 8px;"></i> Tidak ada tugas yang terlambat!
        </td>
      </tr>
    `;
    return;
  }

  overdueTasks.forEach(task => {
    // Determine type badge color
    let typeBadgeClass = 'badge-type-mpe';
    let typeLabel = 'MPE Utama';
    const catLower = (task.category || 'MPE Utama').trim().toLowerCase();

    if (catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept')) {
      typeBadgeClass = 'badge-type-req';
      typeLabel = 'Request Dept.';
    } else if (catLower === 'other project' || catLower.includes('other') || catLower.includes('project')) {
      typeBadgeClass = 'badge-type-prj';
      typeLabel = 'Other Project';
    }

    const daysLate = getDaysOverdue(task.deadline);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family: var(--font-display); font-weight: 700; letter-spacing: 0.5px;">${escapeHtml(task.taskId)}</td>
      <td style="font-weight: 600; text-align: left;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span>${escapeHtml(task.text)}</span>
          <span style="font-size:0.75rem; color:#f59e0b; font-weight:550;"><i class="fa-regular fa-calendar-check"></i> Deadline: ${formatIndonesianDate(task.deadline)}</span>
        </div>
      </td>
      <td style="font-weight: 600;">${escapeHtml(task.picName)}</td>
      <td><span class="badge-type ${typeBadgeClass}">${typeLabel}</span></td>
      <td class="text-danger" style="font-weight: 700;"><i class="fa-solid fa-circle-exclamation"></i> ${daysLate} hari</td>
    `;
    tbody.appendChild(row);
  });
}

function getDaysOverdue(deadlineStr) {
  if (!deadlineStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = today - deadline;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// E. Draw Charts via Chart.js
function drawManagerCharts(tasks) {
  // 1. Line Chart: Avg Team Progress by Date
  // Calculate average progress per date
  const dateMap = {};
  tasks.forEach(t => {
    if (!dateMap[t.tanggal]) {
      dateMap[t.tanggal] = { sum: 0, count: 0 };
    }
    dateMap[t.tanggal].sum += t.progress;
    dateMap[t.tanggal].count++;
  });

  const sortedDates = Object.keys(dateMap).sort();
  const dateLabels = [];
  const progressPoints = [];

  sortedDates.forEach(d => {
    const parts = d.split('-');
    const indonesianMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const label = `${parseInt(parts[2], 10)} ${indonesianMonths[parseInt(parts[1], 10) - 1]}`;

    dateLabels.push(label);
    progressPoints.push(Math.round(dateMap[d].sum / dateMap[d].count));
  });

  // Fallback for empty chart
  if (dateLabels.length === 0) {
    dateLabels.push('No Data');
    progressPoints.push(0);
  }

  const ctxLine = document.getElementById('chart-team-progress').getContext('2d');
  if (chartTeamProgressInstance) {
    chartTeamProgressInstance.destroy();
  }

  chartTeamProgressInstance = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: dateLabels,
      datasets: [{
        label: 'Progress Team',
        data: progressPoints,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', weight: '600' } }
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 25,
            color: '#64748b',
            font: { family: 'Plus Jakarta Sans', weight: '600' },
            callback: function (value) { return value + '%'; }
          },
          grid: { color: '#f1f5f9' }
        }
      }
    }
  });

  // 2. Donut Chart: Job Types Distribution
  let mpeCount = 0;
  let reqCount = 0;
  let otherCount = 0;

  tasks.forEach(t => {
    const catLower = (t.category || 'MPE Utama').trim().toLowerCase();
    if (catLower === 'mpe utama') mpeCount++;
    else if (catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept')) reqCount++;
    else otherCount++;
  });

  const totalTypeTasks = mpeCount + reqCount + otherCount;

  const mpePct = totalTypeTasks > 0 ? Math.round((mpeCount / totalTypeTasks) * 100) : 0;
  const reqPct = totalTypeTasks > 0 ? Math.round((reqCount / totalTypeTasks) * 100) : 0;
  const otherPct = totalTypeTasks > 0 ? Math.round((otherCount / totalTypeTasks) * 100) : 0;

  const ctxDonut = document.getElementById('chart-job-types').getContext('2d');
  if (chartJobTypesInstance) {
    chartJobTypesInstance.destroy();
  }

  chartJobTypesInstance = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: ['MPE Utama', 'Request Dept. Lain', 'Other Project'],
      datasets: [{
        data: [mpeCount, reqCount, otherCount],
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b'],
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      cutout: '65%'
    }
  });

  // Populate Legend
  const legendContainer = document.getElementById('donut-legend-container');
  if (legendContainer) {
    legendContainer.innerHTML = `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:#2563eb;"></span>
        <span class="donut-legend-label">MPE Utama ${mpePct}%</span>
        <span class="donut-legend-count">(${mpeCount})</span>
      </div>
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:#10b981;"></span>
        <span class="donut-legend-label">Request Dept. Lain ${reqPct}%</span>
        <span class="donut-legend-count">(${reqCount})</span>
      </div>
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:#f59e0b;"></span>
        <span class="donut-legend-label">Other Project ${otherPct}%</span>
        <span class="donut-legend-count">(${otherCount})</span>
      </div>
    `;
  }
}

// ==========================================================================
// ALL TASKS TAB LOGIC (MANAGER)
// ==========================================================================
async function loadAllTasksTab() {
  const picSelect = document.getElementById('filter-all-tasks-pic');
  const catSelect = document.getElementById('filter-all-tasks-cat');

  // Populate PIC dropdown
  if (picSelect) {
    picSelect.innerHTML = '<option value="semua">Semua PIC</option>';
    managerEmployeesList.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.nama_lengkap;
      option.textContent = emp.nama_lengkap;
      picSelect.appendChild(option);
    });

    if (!picSelect.dataset.bound) {
      picSelect.addEventListener('change', renderAllTasksTable);
      picSelect.dataset.bound = 'true';
    }
  }

  if (catSelect && !catSelect.dataset.bound) {
    catSelect.addEventListener('change', renderAllTasksTable);
    catSelect.dataset.bound = 'true';
  }

  renderAllTasksTable();
}

function renderAllTasksTable() {
  const tbody = document.getElementById('all-tasks-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const picVal = document.getElementById('filter-all-tasks-pic').value;
  const catVal = document.getElementById('filter-all-tasks-cat').value;

  const filteredTasks = allManagerTasksData.filter(task => {
    if (picVal !== 'semua' && task.picName !== picVal) return false;

    if (catVal !== 'semua') {
      const catLower = (task.category || 'MPE Utama').trim().toLowerCase();
      if (catVal === 'mpe utama' && catLower !== 'mpe utama') return false;
      if (catVal === 'request dept. lain' && !(catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept'))) return false;
      if (catVal === 'other project' && !(catLower === 'other project' || catLower.includes('other') || catLower.includes('project'))) return false;
    }
    return true;
  });

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-dark); padding: 30px; font-weight: 500;">
          <i class="fa-regular fa-folder-open" style="margin-right: 8px;"></i> Tidak ada data pekerjaan yang ditemukan.
        </td>
      </tr>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const isCompleted = task.progress === 100;
    const progressColor = isCompleted ? '#16a34a' : (task.progress >= 50 ? '#2563eb' : '#f59e0b');

    let typeBadgeClass = 'badge-type-mpe';
    let typeLabel = 'MPE Utama';
    const catLower = (task.category || 'MPE Utama').trim().toLowerCase();

    if (catLower === 'request dept. lain' || catLower.includes('request') || catLower.includes('dept')) {
      typeBadgeClass = 'badge-type-req';
      typeLabel = 'Request Dept.';
    } else if (catLower === 'other project' || catLower.includes('other') || catLower.includes('project')) {
      typeBadgeClass = 'badge-type-prj';
      typeLabel = 'Other Project';
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-family: var(--font-display); font-weight: 700; letter-spacing: 0.5px;">${escapeHtml(task.taskId)}</td>
      <td style="font-weight: 600; text-align: left;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span>${escapeHtml(task.text)}</span>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${task.waktu ? `<span style="font-size:0.75rem; color:var(--text-dark); font-weight:550;"><i class="fa-regular fa-clock"></i> ${escapeHtml(task.waktu)}</span>` : ''}
            ${task.deadline ? `<span style="font-size:0.75rem; color:#f59e0b; font-weight:550;"><i class="fa-regular fa-calendar-check"></i> Deadline: ${formatIndonesianDate(task.deadline)}</span>` : ''}
          </div>
        </div>
      </td>
      <td style="font-weight: 600;">${escapeHtml(task.picName)}</td>
      <td><span class="badge-type ${typeBadgeClass}">${typeLabel}</span></td>
      <td>
        <div class="mytasks-progress-cell" style="display:flex; align-items:center; gap:8px;">
          <div class="progress-bar-bg" style="background:#e2e8f0; height:6px; border-radius:3px; flex-grow:1; min-width:80px; overflow:hidden;">
            <div class="progress-bar-fill" style="width: ${task.progress}%; background: ${progressColor}; height:100%;"></div>
          </div>
          <span class="progress-pct" style="color: ${progressColor}; font-weight:700; font-size:0.8rem;">${task.progress}%</span>
        </div>
      </td>
      <td>
        <span class="badge-status ${isCompleted ? 'badge-status-done' : 'badge-status-progress'}">
          ${isCompleted ? 'Selesai' : 'In Progress'}
        </span>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ==========================================================================
// REPORTS FEED TAB LOGIC (MANAGER REPORTS)
// ==========================================================================
async function loadManagerReportsTab() {
  const picSelect = document.getElementById('filter-manager-reports-pic');
  const dateInput = document.getElementById('filter-manager-reports-date');

  if (picSelect) {
    picSelect.innerHTML = '<option value="semua">Semua PIC</option>';
    managerEmployeesList.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;
      option.textContent = emp.nama_lengkap;
      picSelect.appendChild(option);
    });

    if (!picSelect.dataset.bound) {
      picSelect.addEventListener('change', renderManagerReportsList);
      picSelect.dataset.bound = 'true';
    }
  }

  if (dateInput && !dateInput.dataset.bound) {
    dateInput.addEventListener('change', renderManagerReportsList);
    dateInput.dataset.bound = 'true';
  }

  renderManagerReportsList();
}

async function renderManagerReportsList() {
  const grid = document.getElementById('manager-reports-list-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="spinner-container" style="grid-column: 1/-1; margin: 40px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';

  try {
    const response = await fetch('/api/reports/feed');
    if (!response.ok) throw new Error('Failed to fetch reports feed');

    const data = await response.json();
    const reports = data.feed || [];

    grid.innerHTML = '';

    const selectedPic = document.getElementById('filter-manager-reports-pic').value;
    const selectedDate = document.getElementById('filter-manager-reports-date').value;

    const filteredReports = reports.filter(r => {
      if (selectedPic !== 'semua' && String(r.user_id) !== String(selectedPic)) return false;
      if (selectedDate && r.tanggal !== selectedDate) return false;
      return true;
    });

    if (filteredReports.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:var(--text-dark); padding: 40px;">Tidak ada laporan harian yang sesuai filter.</p>';
      return;
    }

    filteredReports.forEach(report => {
      const card = document.createElement('div');
      card.className = 'report-card';
      card.style.background = '#ffffff';
      card.style.border = '1px solid #e2e8f0';

      const formattedDate = formatIndonesianDate(report.tanggal);

      card.innerHTML = `
        <div class="report-card-header" style="border-bottom:1px solid #f1f5f9;">
          <span class="report-date-badge" style="background:#f8fafc; color:#1e293b; border:1px solid #e2e8f0;">
            <i class="fa-solid fa-calendar-day" style="color:#2563eb;"></i>
            <span>${formattedDate}</span>
          </span>
          <div style="text-align:right;">
            <span style="font-weight:700; font-size:0.9rem; color:#0f172a; display:block;">${escapeHtml(report.nama_lengkap)}</span>
            <span style="font-size:0.75rem; color:#64748b;">@${escapeHtml(report.username)}</span>
          </div>
        </div>
        
        <div class="report-card-section">
          <span class="section-title title-todo" style="color:#1e3a8a;">
            <i class="fa-solid fa-clipboard-list"></i> Rencana & Realisasi
          </span>
          ${renderTodoListHtml(report.todo_list)}
        </div>

        ${report.kendala ? `
        <div class="report-card-section">
          <span class="section-title title-kendala" style="color:#b45309;">
            <i class="fa-solid fa-circle-exclamation"></i> Kendala
          </span>
          <div class="report-text" style="border-left: 3px solid #f59e0b; background:#fffbeb; color:#b45309; padding: 6px 12px; border-radius:4px;">${escapeHtml(report.kendala)}</div>
        </div>
        ` : ''}

        <div class="report-card-footer" style="border-top:1px solid #f1f5f9; color:#64748b;">
          Dikirim pada ${formatTimestamp(report.created_at)}
        </div>
      `;
      grid.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#ef4444;">Gagal memuat riwayat laporan karyawan.</p>';
  }
}

// ==========================================================================
// PERFORMANCE TAB LOGIC (LEADERBOARD)
// ==========================================================================
async function loadPerformanceTab() {
  const container = document.getElementById('performance-ranking-container');
  if (!container) return;

  container.innerHTML = '<div class="spinner-container" style="margin: 40px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';

  try {
    // 1. Fetch Employees
    const empRes = await fetch('/api/employees');
    if (!empRes.ok) throw new Error('Gagal mengambil data karyawan');
    const empData = await empRes.json();
    const employees = empData.employees || [];

    // Calculate leaderboard metrics per user
    const userStats = {};
    employees.forEach(emp => {
      userStats[emp.id] = {
        name: emp.nama_lengkap,
        username: emp.username,
        role: emp.role || 'foreman',
        totalTasks: 0,
        completedTasks: 0,
        sumProgress: 0
      };
    });

    allManagerTasksData.forEach(task => {
      if (userStats[task.picId]) {
        userStats[task.picId].totalTasks++;
        userStats[task.picId].sumProgress += task.progress;
        if (task.progress === 100) {
          userStats[task.picId].completedTasks++;
        }
      }
    });

    // Convert stats to array and compute productivity
    const rankList = Object.keys(userStats).map(id => {
      const stats = userStats[id];
      const avgProductivity = stats.totalTasks > 0 ? Math.round(stats.sumProgress / stats.totalTasks) : 0;
      return {
        id: id,
        name: stats.name,
        username: stats.username,
        role: stats.role,
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        productivity: avgProductivity
      };
    });

    // Sort by productivity rank DESC
    rankList.sort((a, b) => b.productivity - a.productivity);

    container.innerHTML = '';

    if (rankList.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding: 40px; color:var(--text-dark);">Belum ada data aktivitas terdaftar.</p>';
      return;
    }

    rankList.forEach((user, index) => {
      const rank = index + 1;
      let rankClass = '';
      if (rank === 1) rankClass = 'rank-1';
      else if (rank === 2) rankClass = 'rank-2';
      else if (rank === 3) rankClass = 'rank-3';

      const card = document.createElement('div');
      card.className = 'performance-card';

      card.innerHTML = `
        <div class="perf-rank ${rankClass}">#${rank}</div>
        <div class="perf-avatar">${getInitials(user.name)}</div>
        <div class="perf-info">
          <h3>${escapeHtml(user.name)}</h3>
          <p>@${escapeHtml(user.username)} • ${escapeHtml(getUserDetails(user.role).jabatan)}</p>
        </div>
        <div class="perf-stats">
          <span>Task Selesai: <strong>${user.completedTasks}</strong> / ${user.totalTasks}</span>
        </div>
        <div class="perf-bar-container">
          <div class="perf-bar-bg">
            <div class="perf-bar-fill" style="width: ${user.productivity}%;"></div>
          </div>
          <span class="perf-pct">${user.productivity}%</span>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="text-align:center; color:#ef4444; padding: 30px;">Gagal memuat analisis performance karyawan.</p>';
  }
}

// ==========================================================================
// SUGGESTION BOX TAB LOGIC (EMPLOYEE & MANAGER SIDES)
// ==========================================================================
async function loadSuggestionsTab() {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = currentUser && currentUser.role && adminRoles.includes(currentUser.role.toLowerCase());

  const empSection = document.getElementById('employee-suggestion-content');
  const mgrSection = document.getElementById('manager-suggestion-content');

  if (isAdmin) {
    if (empSection) empSection.classList.add('hidden');
    if (mgrSection) mgrSection.classList.remove('hidden');

    await loadManagerSuggestions();
  } else {
    if (empSection) empSection.classList.remove('hidden');
    if (mgrSection) mgrSection.classList.add('hidden');

    // Hook employee suggestions form submit once
    const suggestForm = document.getElementById('form-submit-suggestion');
    if (suggestForm && !suggestForm.dataset.bound) {
      suggestForm.addEventListener('submit', handleSuggestionSubmit);
      suggestForm.dataset.bound = 'true';
    }

    await loadEmployeeSuggestions();
  }
}

// F. Employee Submission
async function handleSuggestionSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('suggest-title').value.trim();
  const category = 'Umum';
  const content = document.getElementById('suggest-content').value.trim();

  if (!title || !content) {
    showToast('Harap lengkapi isi saran Anda.', 'error');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, content })
    });

    const data = await response.json();
    if (response.ok) {
      showToast(data.message || 'Saran berhasil terkirim!', 'success');
      document.getElementById('form-submit-suggestion').reset();
      await loadEmployeeSuggestions();
    } else {
      showToast(data.error || 'Gagal mengirim saran.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan koneksi internet.', 'error');
  } finally {
    showLoading(false);
  }
}

// G. Employee: Load my suggestions
async function loadEmployeeSuggestions() {
  const container = document.getElementById('my-suggestions-list');
  if (!container) return;

  container.innerHTML = '<div class="spinner-container" style="margin: 20px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';

  try {
    const response = await fetch('/api/suggestions');
    if (!response.ok) throw new Error('Gagal memuat saran');

    const data = await response.json();
    const suggestions = data.suggestions || [];

    container.innerHTML = '';

    if (suggestions.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding: 20px; color:#64748b;">Belum ada saran yang Anda kirimkan.</p>';
      return;
    }

    suggestions.forEach(item => {
      const card = document.createElement('div');
      card.className = 'suggestion-card';

      const isReviewed = item.status === 'Reviewed';
      const statusClass = isReviewed ? 'status-badge-reviewed' : 'status-badge-pending';
      const statusLabel = isReviewed ? 'Selesai Ditinjau' : 'Menunggu Tindakan';

      card.innerHTML = `
        <div class="suggestion-header">
          <span class="suggestion-title">${escapeHtml(item.title)}</span>
        </div>
        <p class="suggestion-content">${escapeHtml(item.content)}</p>
        <div class="suggestion-footer">
            <span>Dikirim: ${formatIndonesianDate((item.created_at ? item.created_at.replace('T', ' ').split(' ')[0] : ''))}</span>
          <span class="badge-type ${statusClass}" style="font-size:0.75rem; border:none; padding: 3px 6px;">${statusLabel}</span>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:#ef4444; text-align:center;">Gagal mengambil riwayat saran Anda.</p>';
  }
}

// H. Manager: Load incoming suggestions
async function loadManagerSuggestions() {
  const container = document.getElementById('manager-suggestions-list');
  if (!container) return;

  container.innerHTML = '<div class="spinner-container" style="margin: 20px auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div>';

  try {
    const response = await fetch('/api/suggestions');
    if (!response.ok) throw new Error('Gagal memuat saran tim');

    const data = await response.json();
    const suggestions = data.suggestions || [];

    container.innerHTML = '';

    if (suggestions.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 40px; color:var(--text-dark);">Belum ada saran masuk dari karyawan.</p>';
      return;
    }

    suggestions.forEach(item => {
      const card = document.createElement('div');
      card.className = 'suggestion-card';

      const isReviewed = item.status === 'Reviewed';
      const statusClass = isReviewed ? 'status-badge-reviewed' : 'status-badge-pending';
      const statusLabel = isReviewed ? 'Telah Ditinjau' : 'Baru / Pending';

      card.innerHTML = `
        <div class="suggestion-header">
          <span class="suggestion-title">${escapeHtml(item.title)}</span>
        </div>
        <p class="suggestion-content">${escapeHtml(item.content)}</p>
        <div class="suggestion-footer">
          <div>
            <span class="suggest-user">${escapeHtml(item.nama_lengkap)}</span>
            <span style="color:#cbd5e1; margin:0 4px;">•</span>
            <span>@${escapeHtml(item.username)}</span>
          </div>
          <div class="suggest-actions">
            ${!isReviewed ? `<button class="btn-suggest-action btn-suggest-ok" onclick="updateSuggestionStatus(${item.id})"><i class="fa-solid fa-check"></i> Tandai Ditinjau</button>` : `<span class="badge-type status-badge-reviewed" style="font-size:0.7rem; border:none; padding:2px 6px;">${statusLabel}</span>`}
            <button class="btn-suggest-action btn-suggest-del" onclick="deleteSuggestion(${item.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:#ef4444; text-align:center;">Gagal mengambil saran masuk.</p>';
  }
}

// I. Suggestions actions
async function updateSuggestionStatus(id) {
  showLoading(true);
  try {
    const res = await fetch(`/api/suggestions/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Reviewed' })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Saran ditandai sebagai ditinjau.', 'success');
      await loadManagerSuggestions();
    } else {
      showToast(data.error || 'Gagal mengubah status saran.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteSuggestion(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus saran ini?')) return;
  showLoading(true);
  try {
    const res = await fetch(`/api/suggestions/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Saran berhasil dihapus.', 'success');
      await loadSuggestionsTab();
    } else {
      showToast(data.error || 'Gagal menghapus saran.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}

window.updateSuggestionStatus = updateSuggestionStatus;
window.deleteSuggestion = deleteSuggestion;

// ==========================================================================
// MASTER DATA USER ADMINISTRATION
// ==========================================================================
async function loadMasterDataTab() {
  const tbody = document.getElementById('master-users-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;"><div class="spinner-container" style="margin:auto;"><div class="double-bounce1"></div><div class="double-bounce2"></div></div></td></tr>';

  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Gagal mengambil data user list');
    const data = await res.json();
    const users = data.users || [];

    tbody.innerHTML = '';

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">Tidak ada data user terdaftar.</td></tr>';
      return;
    }

    users.forEach((u, index) => {
      const isCurrentUser = currentUser && currentUser.id === u.id;
      const rawDate = u.created_at ? u.created_at.replace('T', ' ').split(' ')[0] : '';
      const formattedDate = rawDate ? formatIndonesianDate(rawDate) : '-';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight:bold; font-family:var(--font-display);">${index + 1}</td>
        <td style="font-weight:600;">@${escapeHtml(u.username)}</td>
        <td style="font-weight:700;">${escapeHtml(u.nama_lengkap)} ${isCurrentUser ? '<span style="font-size:0.75rem; background:rgba(99,102,241,0.2); padding: 2px 6px; border-radius:4px; margin-left:5px; color:var(--primary);">Saya</span>' : ''}</td>
        <td><span style="font-weight:600; text-transform:capitalize;">${escapeHtml(getUserDetails(u.role).jabatan)}</span></td>
        <td>${formattedDate}</td>
        <td style="font-family:var(--font-display); font-weight:800; text-align:center;">${u.report_count} Lapor</td>
        <td>
          ${isCurrentUser ? '<span style="color:#94a3b8; font-style:italic; font-size:0.85rem;">Tidak Ada Aksi</span>' : `<button class="btn btn-secondary" onclick="deleteUserAccount(${u.id}, '${escapeHtml(u.username)}')" style="padding: 4px 10px; font-size:0.8rem; background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.2); color:#ef4444;"><i class="fa-solid fa-trash-can"></i> Hapus</button>`}
        </td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444; font-weight:bold;">Gagal mengambil data master pengguna.</td></tr>';
  }
}

async function deleteUserAccount(id, username) {
  if (!confirm(`Apakah Anda yakin ingin menghapus akun @${username}? Semua laporan aktivitas miliknya juga akan dihapus permanen.`)) return;

  showLoading(true);

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Akun berhasil dihapus.', 'success');
      await loadMasterDataTab();
      // Reload manager stats
      await loadManagerDashboardData();
    } else {
      showToast(data.error || 'Gagal menghapus akun.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan koneksi.', 'error');
  } finally {
    showLoading(false);
  }
}

window.deleteUserAccount = deleteUserAccount;

// Add user modal controls
function showAddUserModal() {
  const modal = document.getElementById('modal-add-user');
  if (modal) {
    modal.classList.add('show');
    const form = document.getElementById('form-add-user-modal');
    if (form) form.reset();
  }
}

function closeAddUserModal() {
  const modal = document.getElementById('modal-add-user');
  if (modal) modal.classList.remove('show');
}

async function submitNewUserFromModal() {
  const usernameInput = document.getElementById('modal-register-username');
  const namaInput = document.getElementById('modal-register-nama-lengkap');
  const roleInput = document.getElementById('modal-register-role');
  const passwordInput = document.getElementById('modal-register-password');

  const username = usernameInput ? usernameInput.value.trim() : '';
  const nama_lengkap = namaInput ? namaInput.value.trim() : '';
  const role = roleInput ? roleInput.value : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !nama_lengkap || !role || !password) {
    showToast('Harap isi semua kolom pendaftaran.', 'error');
    return;
  }

  if (username.length < 3 || username.includes(' ')) {
    showToast('Username minimal 3 karakter tanpa spasi.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password minimal 6 karakter.', 'error');
    return;
  }

  showLoading(true);

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, nama_lengkap, password, role })
    });

    const data = await response.json();
    if (response.ok) {
      showToast(data.message || 'Akun baru berhasil didaftarkan!', 'success');
      closeAddUserModal();
      await loadMasterDataTab();
      // Reload manager stats
      await loadManagerDashboardData();
    } else {
      showToast(data.error || 'Registrasi gagal.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan koneksi internet.', 'error');
  } finally {
    showLoading(false);
  }
}

window.showAddUserModal = showAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.submitNewUserFromModal = submitNewUserFromModal;

// Click event delegation for backdrop closing and action buttons
document.addEventListener('click', (e) => {
  // Close edit task modal on backdrop click
  const modalUpdate = document.getElementById('modal-update-progress');
  if (modalUpdate && e.target === modalUpdate) {
    closeUpdateProgressModal();
    return;
  }

  // Close add user modal on backdrop click
  const modalAdd = document.getElementById('modal-add-user');
  if (modalAdd && e.target === modalAdd) {
    closeAddUserModal();
    return;
  }

  // Handle .btn-edit-progress click (or click on the icon inside it)
  const btn = e.target.closest('.btn-edit-progress');
  if (btn) {
    const reportId = parseInt(btn.dataset.reportId);
    const itemIndex = parseInt(btn.dataset.itemIndex);
    const taskText = decodeURIComponent(btn.dataset.text || '');
    const progress = parseInt(btn.dataset.progress || '0');
    const description = decodeURIComponent(btn.dataset.description || '');
    const kendala = decodeURIComponent(btn.dataset.kendala || '');
    const deadline = btn.dataset.deadline || '';
    openUpdateProgressModal(reportId, itemIndex, taskText, progress, description, kendala, deadline);
  }
});

// ==========================================================================
// SETTINGS TAB LOGIC
// ==========================================================================
function loadSettingsTab() {
  if (!currentUser) return;
  const avatar = document.getElementById('settings-avatar');
  const fullname = document.getElementById('settings-fullname');
  const role = document.getElementById('settings-role');

  if (avatar) avatar.textContent = getInitials(currentUser.nama_lengkap);
  if (fullname) fullname.textContent = currentUser.nama_lengkap;
  if (role) role.textContent = getUserDetails(currentUser.role).jabatan + ' - Mineplan Engineering';
}
