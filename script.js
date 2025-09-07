(() => {
  const STORAGE_KEYS = {
    issues: 'civic_issues',
    theme: 'theme_preference',
    notifications: 'civic_notifications',
    session: 'civic_session',
    reporters: 'civic_reporters'
  };

  const STATUS_ORDER = ['Pending', 'In Progress', 'Resolved'];

  function getStored(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function setStored(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() { return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

  function ensureDummyData() {
    const existing = getStored(STORAGE_KEYS.issues, null);
    if (existing && existing.length) return;
    const demo = [
      {
        id: uid(), title: 'Pothole on Main St', name: 'Alex Doe', email: 'alex@example.com',
        location: 'Main St & 5th Ave', type: 'Road', description: 'Large pothole causing traffic issues.', imageDataUrl: '',
        status: 'Pending', upvotes: 12, createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3
      },
      {
        id: uid(), title: 'Streetlight not working', name: 'Priya N', email: 'priya@example.com',
        location: 'Elm Street Park', type: 'Lighting', description: 'Streetlight out near playground.', imageDataUrl: '',
        status: 'In Progress', upvotes: 7, createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2
      },
      {
        id: uid(), title: 'Overflowing trash bin', name: 'Sam K', email: 'sam@example.com',
        location: 'Riverside Walk', type: 'Sanitation', description: 'Needs urgent cleanup.', imageDataUrl: '',
        status: 'Resolved', upvotes: 3, createdAt: Date.now() - 1000 * 60 * 60 * 24
      }
    ];
    setStored(STORAGE_KEYS.issues, demo);
  }

  function applyTheme() {
    const pref = getStored(STORAGE_KEYS.theme, 'dark');
    document.documentElement.classList.toggle('theme-light', pref === 'light');
    const toggle = document.querySelector('[data-action="toggle-theme"]');
    if (toggle) toggle.setAttribute('aria-label', `Switch to ${pref === 'light' ? 'dark' : 'light'} mode`);
  }

  function toggleTheme() {
    const current = getStored(STORAGE_KEYS.theme, 'dark');
    const next = current === 'light' ? 'dark' : 'light';
    setStored(STORAGE_KEYS.theme, next);
    applyTheme();
  }

  function showBanner(message) {
    const banner = document.querySelector('.banner');
    if (!banner) return;
    const msg = banner.querySelector('[data-banner-msg]');
    if (msg) msg.textContent = message;
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 5000);
  }

  function emitNotification(text) {
    const notifications = getStored(STORAGE_KEYS.notifications, []);
    notifications.push({ id: uid(), text, at: Date.now() });
    setStored(STORAGE_KEYS.notifications, notifications);
  }

  function consumeNotifications() {
    const notifications = getStored(STORAGE_KEYS.notifications, []);
    if (notifications.length) {
      showBanner(notifications[0].text);
      setStored(STORAGE_KEYS.notifications, notifications.slice(1));
    }
  }

  function statusToProgress(status) {
    if (status === 'Pending') return 10;
    if (status === 'In Progress') return 55;
    if (status === 'Resolved') return 100;
    return 0;
  }

  function saveReporterActivity(email) {
    if (!email) return;
    const reporters = getStored(STORAGE_KEYS.reporters, {});
    reporters[email] = (reporters[email] || 0) + 1;
    setStored(STORAGE_KEYS.reporters, reporters);
  }
  function getBadgeFor(email) {
    const reporters = getStored(STORAGE_KEYS.reporters, {});
    const count = reporters[email] || 0;
    if (count >= 10) return 'Platinum Reporter';
    if (count >= 5) return 'Gold Reporter';
    if (count >= 3) return 'Silver Reporter';
    if (count >= 1) return 'Bronze Reporter';
    return '';
  }

  function readImageAsDataUrl(file) {
    return new Promise((resolve) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  // Navbar events
  function initNavbar() {
    const themeBtn = document.querySelector('[data-action="toggle-theme"]');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  }

  // Index: simple CTA wiring
  function initHome() {
    const cta = document.querySelector('[data-goto="report"]');
    if (cta) cta.addEventListener('click', () => window.location.href = 'report.html');
  }

  // Report page
  function initReport() {
    const form = document.querySelector('#report-form');
    const mapFrame = document.querySelector('#map-frame');
    const locInput = document.querySelector('#location');
    const statusEl = document.querySelector('#form-status');

    function updateMap(q) {
      if (!mapFrame) return;
      const query = encodeURIComponent(q || 'City Center');
      mapFrame.src = `https://www.google.com/maps?q=${query}&output=embed`;
    }
    if (locInput) {
      updateMap(locInput.value);
      locInput.addEventListener('input', (e) => updateMap(e.target.value));
    }

    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = '';
      const fd = new FormData(form);
      const name = fd.get('name')?.toString().trim();
      const email = fd.get('email')?.toString().trim();
      const location = fd.get('location')?.toString().trim();
      const type = fd.get('type')?.toString();
      const description = fd.get('description')?.toString().trim();
      const imageFile = fd.get('image');
      const title = fd.get('title')?.toString().trim() || `${type} Issue`;

      // Simple validation
      const errors = [];
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!name) errors.push('Name is required');
      if (!email || !emailRe.test(email)) errors.push('Valid email is required');
      if (!location) errors.push('Location is required');
      if (!type) errors.push('Issue type is required');
      if (!description || description.length < 10) errors.push('Description must be at least 10 characters');

      if (errors.length) {
        statusEl.textContent = errors.join(' • ');
        statusEl.className = 'error';
        return;
      }

      const imageDataUrl = await readImageAsDataUrl(imageFile);
      const issues = getStored(STORAGE_KEYS.issues, []);
      const newIssue = {
        id: uid(), title, name, email, location, type, description, imageDataUrl,
        status: 'Pending', upvotes: 0, createdAt: Date.now()
      };
      issues.unshift(newIssue);
      setStored(STORAGE_KEYS.issues, issues);
      saveReporterActivity(email);

      statusEl.textContent = 'Issue submitted successfully. Thank you for your report!';
      statusEl.className = 'success';
      form.reset();
      updateMap('');
    });
  }

  // Dashboard
  function renderIssues(listEl, issues) {
    listEl.innerHTML = '';
    for (const issue of issues) {
      const card = document.createElement('div');
      card.className = 'card issue-card';
      const progress = statusToProgress(issue.status);
      const badge = getBadgeFor(issue.email);
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:start; gap:8px;">
          <div>
            <h3>${issue.title}</h3>
            <div class="muted">${issue.type} • ${issue.location}</div>
          </div>
          <span class="status ${issue.status === 'Pending' ? 'pending' : issue.status === 'In Progress' ? 'progress' : 'resolved'}">${issue.status}</span>
        </div>
        ${issue.imageDataUrl ? `<img src="${issue.imageDataUrl}" alt="Issue image" style="border-radius:10px; border:1px solid var(--border);">` : ''}
        <p class="muted">${issue.description}</p>
        <div class="progress"><span style="width:${progress}%;"></span></div>
        <div class="card-actions">
          <button class="btn upvote" data-id="${issue.id}">⬆ Upvote <span>(${issue.upvotes})</span></button>
          ${badge ? `<span class="chip">🏅 ${badge}</span>` : ''}
        </div>
      `;
      listEl.appendChild(card);
    }
  }

  function initDashboard() {
    const listEl = document.querySelector('#issues');
    const qEl = document.querySelector('#q');
    const catEl = document.querySelector('#filter-type');
    const statusEl = document.querySelector('#filter-status');
    if (!listEl) return;

    function getFiltered() {
      const q = (qEl?.value || '').toLowerCase();
      const cat = catEl?.value || 'all';
      const st = statusEl?.value || 'all';
      let items = getStored(STORAGE_KEYS.issues, []);
      if (q) items = items.filter(i => `${i.title} ${i.description} ${i.location} ${i.type}`.toLowerCase().includes(q));
      if (cat !== 'all') items = items.filter(i => i.type === cat);
      if (st !== 'all') items = items.filter(i => i.status === st);
      items.sort((a,b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.upvotes - a.upvotes || b.createdAt - a.createdAt);
      return items;
    }

    function refresh() {
      renderIssues(listEl, getFiltered());
    }

    refresh();
    qEl?.addEventListener('input', refresh);
    catEl?.addEventListener('change', refresh);
    statusEl?.addEventListener('change', refresh);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.upvote');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const issues = getStored(STORAGE_KEYS.issues, []);
      const idx = issues.findIndex(i => i.id === id);
      if (idx !== -1) {
        issues[idx].upvotes += 1;
        setStored(STORAGE_KEYS.issues, issues);
        refresh();
      }
    });
  }

  // Admin
  function drawChart(ctx, dataMap) {
    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const padding = 24;
    const max = Math.max(1, ...values);
    const barW = (width - padding * 2) / labels.length - 12;

    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = width * dpr;
    ctx.canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted');
    ctx.font = '12px sans-serif';

    labels.forEach((label, i) => {
      const val = values[i];
      const h = ((height - padding * 2) * val) / max;
      const x = padding + i * (barW + 12);
      const y = height - padding - h;
      const grd = ctx.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--accent'));
      grd.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--primary'));
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, barW, h);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
      ctx.fillText(label, x, height - padding + 12);
      ctx.fillText(String(val), x, y - 4);
    });
  }

  function initAdmin() {
    const login = document.querySelector('#admin-login');
    const list = document.querySelector('#admin-list');
    const chart = document.querySelector('#chart');
    const status = document.querySelector('#login-status');

    const session = getStored(STORAGE_KEYS.session, { authed: false });
    function renderIssuesAdmin() {
      if (!list) return;
      const issues = getStored(STORAGE_KEYS.issues, []);
      list.innerHTML = '';
      for (const issue of issues) {
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <h3>${issue.title}</h3>
              <div class="muted">${issue.type} • ${issue.location}</div>
            </div>
            <select data-id="${issue.id}">
              ${['Pending','In Progress','Resolved'].map(s => `<option value="${s}" ${s===issue.status?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        `;
        list.appendChild(item);
      }
    }

    function renderChart() {
      if (!chart) return;
      const issues = getStored(STORAGE_KEYS.issues, []);
      const byType = {};
      for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;
      const ctx = chart.getContext('2d');
      drawChart(ctx, byType);
    }

    function showAdminUI(authed) {
      document.querySelector('[data-admin="login"]').classList.toggle('hide', authed);
      document.querySelector('[data-admin="panel"]').classList.toggle('hide', !authed);
      if (authed) { renderIssuesAdmin(); renderChart(); }
    }

    showAdminUI(session.authed);

    login?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(login);
      const u = fd.get('username');
      const p = fd.get('password');
      if (u === 'admin' && p === 'admin') {
        setStored(STORAGE_KEYS.session, { authed: true });
        status.textContent = '';
        showAdminUI(true);
      } else {
        status.textContent = 'Invalid credentials';
        status.className = 'error';
      }
    });

    document.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-id]');
      if (!sel) return;
      const id = sel.getAttribute('data-id');
      const newStatus = sel.value;
      const issues = getStored(STORAGE_KEYS.issues, []);
      const idx = issues.findIndex(i => i.id === id);
      if (idx !== -1) {
        issues[idx].status = newStatus;
        setStored(STORAGE_KEYS.issues, issues);
        emitNotification(`Status for "${issues[idx].title}" changed to ${newStatus}`);
        renderIssuesAdmin();
        renderChart();
      }
    });
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    ensureDummyData();
    applyTheme();
    initNavbar();
    consumeNotifications();

    const page = document.body.getAttribute('data-page');
    if (page === 'home') initHome();
    if (page === 'report') initReport();
    if (page === 'dashboard') initDashboard();
    if (page === 'admin') initAdmin();
  });
})();


