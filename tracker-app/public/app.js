/* ── State ───────────────────────────────────────────────────────────────── */
const state = { skills: [], projects: [], todos: [], notes: [] };
let editingId   = null;
let editingType = null;
let confirmCb   = null;

/* ── API ─────────────────────────────────────────────────────────────────── */
const API = '/api';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function loadAll() {
  const [skills, projects, todos, notes] = await Promise.all([
    req('GET', '/skills'),
    req('GET', '/projects'),
    req('GET', '/todos'),
    req('GET', '/notes'),
  ]);
  state.skills   = skills;
  state.projects = projects;
  state.todos    = todos;
  state.notes    = notes;
}

/* ── Navigation ──────────────────────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  closeSidebar();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'skills')    renderSkills();
  if (tab === 'projects')  renderProjects();
  if (tab === 'todos')     renderTodos();
  if (tab === 'notes')     renderNotes();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

/* ── Render helpers ──────────────────────────────────────────────────────── */
function progressBar(pct, cls = '') {
  return `<div class="progress-wrap">
    <div class="progress-label"><span>${pct}%</span></div>
    <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
  </div>`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function relTime(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */
async function renderDashboard() {
  // Date
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // Stats
  const stats = await req('GET', '/stats');
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-number">${stats.skills}</div><div class="stat-label">Skills</div></div>
    <div class="stat-card"><div class="stat-number">${stats.skills_avg}%</div><div class="stat-label">Avg Skill</div></div>
    <div class="stat-card"><div class="stat-number">${stats.projects_active}</div><div class="stat-label">Active Projects</div></div>
    <div class="stat-card"><div class="stat-number">${stats.todos_done}/${stats.todos_total}</div><div class="stat-label">Todos Done</div></div>
    <div class="stat-card"><div class="stat-number">${stats.notes}</div><div class="stat-label">Notes</div></div>
  `;

  // Todos (upcoming, not done)
  const upcoming = state.todos.filter(t => !t.done).slice(0, 5);
  document.getElementById('dash-todos').innerHTML = upcoming.length
    ? upcoming.map(t => `
        <div class="todo-item">
          <div class="todo-check ${t.done ? 'checked' : ''}" onclick="toggleTodo(${t.id})">${t.done ? '✓' : ''}</div>
          <div class="todo-body">
            <div class="todo-title ${t.done ? 'done-text' : ''}">${escHtml(t.title)}</div>
            <div class="todo-sub">
              <span class="badge badge-${t.priority}">${t.priority}</span>
              ${t.due_date ? `<span>Due ${fmtDate(t.due_date)}</span>` : ''}
              ${t.project_name ? `<span>${escHtml(t.project_name)}</span>` : ''}
            </div>
          </div>
        </div>`).join('')
    : '<div class="dash-empty">No pending todos</div>';

  // Notes
  const recent = state.notes.slice(0, 3);
  document.getElementById('dash-notes').innerHTML = recent.length
    ? recent.map(n => `
        <div class="card" style="margin-bottom:10px">
          <div class="card-title"><span>${escHtml(n.title)}</span></div>
          <div class="card-meta">${relTime(n.updated_at)}</div>
          <div class="note-content">${escHtml(n.content)}</div>
        </div>`).join('')
    : '<div class="dash-empty">No notes yet</div>';

  // Skills
  const top = [...state.skills].sort((a,b) => a.progress - b.progress).slice(0, 6);
  document.getElementById('dash-skills').innerHTML = top.length
    ? top.map(s => `
        <div class="skill-row">
          <div class="skill-row-name" title="${escHtml(s.name)}">${escHtml(s.name)}</div>
          <div class="skill-row-bar">${progressBar(s.progress)}</div>
        </div>`).join('')
    : '<div class="dash-empty">No skills tracked yet</div>';
}

/* ── Skills ──────────────────────────────────────────────────────────────── */
function renderSkills() {
  const q   = document.getElementById('skill-search')?.value.toLowerCase() ?? '';
  const cat = document.getElementById('skill-cat-filter')?.value ?? '';

  // Populate category filter
  const cats = [...new Set(state.skills.map(s => s.category).filter(Boolean))];
  const cf = document.getElementById('skill-cat-filter');
  const curVal = cf.value;
  cf.innerHTML = '<option value="">All categories</option>' +
    cats.map(c => `<option value="${escHtml(c)}" ${c === curVal ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

  const filtered = state.skills.filter(s =>
    (s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)) &&
    (!cat || s.category === cat)
  );

  document.getElementById('skills-list').innerHTML = filtered.length ? filtered.map(s => `
    <div class="card">
      <div class="card-title">
        <span>${escHtml(s.name)}</span>
        <div class="card-actions">
          <button class="btn-icon" title="Edit" onclick="openModal('skill',${s.id})">✏️</button>
          <button class="btn-icon" title="Delete" onclick="confirmDelete('skill',${s.id},'${escHtml(s.name)}')">🗑️</button>
        </div>
      </div>
      ${s.category ? `<div class="card-meta">${escHtml(s.category)}</div>` : ''}
      ${s.notes ? `<div class="card-desc">${escHtml(s.notes)}</div>` : ''}
      ${progressBar(s.progress)}
    </div>
  `).join('') : '<div class="dash-empty">No skills found. Add one above!</div>';
}

/* ── Projects ────────────────────────────────────────────────────────────── */
function renderProjects() {
  const q  = document.getElementById('project-search')?.value.toLowerCase() ?? '';
  const st = document.getElementById('project-status-filter')?.value ?? '';

  const filtered = state.projects.filter(p =>
    (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
    (!st || p.status === st)
  );

  document.getElementById('projects-list').innerHTML = filtered.length ? filtered.map(p => `
    <div class="card">
      <div class="card-title">
        <span>${escHtml(p.name)}</span>
        <div class="card-actions">
          <button class="btn-icon" title="Edit" onclick="openModal('project',${p.id})">✏️</button>
          <button class="btn-icon" title="Delete" onclick="confirmDelete('project',${p.id},'${escHtml(p.name)}')">🗑️</button>
        </div>
      </div>
      <div class="card-meta">
        <span class="badge badge-${p.status}">${p.status}</span>
        <span style="margin-left:8px">Updated ${relTime(p.updated_at)}</span>
      </div>
      ${p.description ? `<div class="card-desc">${escHtml(p.description)}</div>` : ''}
      ${progressBar(p.progress, p.status === 'completed' ? 'green' : '')}
    </div>
  `).join('') : '<div class="dash-empty">No projects found. Add one above!</div>';
}

/* ── Todos ───────────────────────────────────────────────────────────────── */
function renderTodos() {
  const q    = document.getElementById('todo-search')?.value.toLowerCase() ?? '';
  const pri  = document.getElementById('todo-priority-filter')?.value ?? '';
  const done = document.getElementById('todo-done-filter')?.value ?? '';

  const filtered = state.todos.filter(t =>
    (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) &&
    (!pri  || t.priority === pri) &&
    (done === '' || String(t.done) === done)
  );

  document.getElementById('todos-list').innerHTML = filtered.length ? filtered.map(t => `
    <div class="todo-item ${t.done ? 'done' : ''}">
      <div class="todo-check ${t.done ? 'checked' : ''}" title="Toggle done" onclick="toggleTodo(${t.id})">${t.done ? '✓' : ''}</div>
      <div class="todo-body">
        <div class="todo-title ${t.done ? 'done-text' : ''}">${escHtml(t.title)}</div>
        ${t.description ? `<div class="card-desc" style="margin:4px 0 0">${escHtml(t.description)}</div>` : ''}
        <div class="todo-sub">
          <span class="badge badge-${t.priority}">${t.priority}</span>
          ${t.due_date ? `<span>📅 ${fmtDate(t.due_date)}</span>` : ''}
          ${t.project_name ? `<span>🚀 ${escHtml(t.project_name)}</span>` : ''}
          ${t.skill_name   ? `<span>🎯 ${escHtml(t.skill_name)}</span>`   : ''}
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn-icon" title="Edit" onclick="openModal('todo',${t.id})">✏️</button>
        <button class="btn-icon" title="Delete" onclick="confirmDelete('todo',${t.id},'${escHtml(t.title)}')">🗑️</button>
      </div>
    </div>
  `).join('') : '<div class="dash-empty">No todos found. Add one above!</div>';
}

async function toggleTodo(id) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;
  const updated = await req('PUT', `/todos/${id}`, { done: !t.done });
  Object.assign(t, updated);
  renderTodos();
  renderDashboard();
  toast(t.done ? 'Marked as done' : 'Marked as active');
}

/* ── Notes ───────────────────────────────────────────────────────────────── */
function renderNotes() {
  const q   = document.getElementById('note-search')?.value.toLowerCase() ?? '';
  const tag = document.getElementById('note-tag-filter')?.value.toLowerCase() ?? '';

  const filtered = state.notes.filter(n =>
    (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) &&
    (!tag || n.tags.toLowerCase().includes(tag))
  );

  document.getElementById('notes-list').innerHTML = filtered.length ? filtered.map(n => `
    <div class="card">
      <div class="card-title">
        <span>${escHtml(n.title)}</span>
        <div class="card-actions">
          <button class="btn-icon" title="Edit" onclick="openModal('note',${n.id})">✏️</button>
          <button class="btn-icon" title="Delete" onclick="confirmDelete('note',${n.id},'${escHtml(n.title)}')">🗑️</button>
        </div>
      </div>
      <div class="card-meta">
        ${n.project_name ? `<span>🚀 ${escHtml(n.project_name)}</span>` : ''}
        ${n.skill_name   ? `<span>🎯 ${escHtml(n.skill_name)}</span>`   : ''}
        <span>Updated ${relTime(n.updated_at)}</span>
      </div>
      <div class="note-content">${escHtml(n.content)}</div>
      ${n.tags ? `<div class="tags">${n.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('') : '<div class="dash-empty">No notes found. Add one above!</div>';
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
function openModal(type, id = null) {
  editingType = type;
  editingId   = id;

  const data = id ? state[type + 's']?.find(x => x.id === id) : null;
  const isEdit = !!data;

  document.getElementById('modal-title').textContent =
    (isEdit ? 'Edit ' : 'Add ') + type.charAt(0).toUpperCase() + type.slice(1);

  const projectOpts = state.projects.map(p =>
    `<option value="${p.id}" ${data?.project_id === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
  ).join('');
  const skillOpts = state.skills.map(s =>
    `<option value="${s.id}" ${data?.skill_id === s.id ? 'selected' : ''}>${escHtml(s.name)}</option>`
  ).join('');

  let html = '';

  if (type === 'skill') {
    html = `
      <div class="form-group"><label>Name *</label><input id="f-name" value="${escHtml(data?.name ?? '')}" placeholder="e.g. Python"></div>
      <div class="form-group"><label>Category</label><input id="f-cat" value="${escHtml(data?.category ?? '')}" placeholder="e.g. Programming"></div>
      <div class="form-group">
        <label>Progress: <span id="prog-val">${data?.progress ?? 0}</span>%</label>
        <input type="range" id="f-progress" min="0" max="100" value="${data?.progress ?? 0}" oninput="document.getElementById('prog-val').textContent=this.value" style="width:100%;accent-color:var(--accent)">
      </div>
      <div class="form-group"><label>Notes</label><textarea id="f-notes" placeholder="What have you learned?">${escHtml(data?.notes ?? '')}</textarea></div>
    `;
  } else if (type === 'project') {
    html = `
      <div class="form-group"><label>Name *</label><input id="f-name" value="${escHtml(data?.name ?? '')}" placeholder="Project name"></div>
      <div class="form-group"><label>Description</label><textarea id="f-desc" placeholder="What's this project about?">${escHtml(data?.description ?? '')}</textarea></div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="f-status">
            ${['active','paused','completed','cancelled'].map(s => `<option value="${s}" ${(data?.status ?? 'active') === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Progress: <span id="prog-val">${data?.progress ?? 0}</span>%</label>
          <input type="range" id="f-progress" min="0" max="100" value="${data?.progress ?? 0}" oninput="document.getElementById('prog-val').textContent=this.value" style="width:100%;accent-color:var(--accent)">
        </div>
      </div>
    `;
  } else if (type === 'todo') {
    html = `
      <div class="form-group"><label>Title *</label><input id="f-name" value="${escHtml(data?.title ?? '')}" placeholder="What needs to be done?"></div>
      <div class="form-group"><label>Description</label><textarea id="f-desc" placeholder="More details…">${escHtml(data?.description ?? '')}</textarea></div>
      <div class="form-row">
        <div class="form-group">
          <label>Priority</label>
          <select id="f-priority">
            ${['high','medium','low'].map(p => `<option value="${p}" ${(data?.priority ?? 'medium') === p ? 'selected' : ''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Due date</label><input type="date" id="f-due" value="${data?.due_date ?? ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Project</label>
          <select id="f-project"><option value="">None</option>${projectOpts}</select>
        </div>
        <div class="form-group">
          <label>Skill</label>
          <select id="f-skill"><option value="">None</option>${skillOpts}</select>
        </div>
      </div>
    `;
  } else if (type === 'note') {
    html = `
      <div class="form-group"><label>Title *</label><input id="f-name" value="${escHtml(data?.title ?? '')}" placeholder="Note title"></div>
      <div class="form-group"><label>Content</label><textarea id="f-desc" style="min-height:160px" placeholder="Write your note here…">${escHtml(data?.content ?? '')}</textarea></div>
      <div class="form-group"><label>Tags (comma-separated)</label><input id="f-tags" value="${escHtml(data?.tags ?? '')}" placeholder="e.g. react, tips, api"></div>
      <div class="form-row">
        <div class="form-group">
          <label>Project</label>
          <select id="f-project"><option value="">None</option>${projectOpts}</select>
        </div>
        <div class="form-group">
          <label>Skill</label>
          <select id="f-skill"><option value="">None</option>${skillOpts}</select>
        </div>
      </div>
    `;
  }

  html += `<div class="form-actions">
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="saveModal()">Save</button>
  </div>`;

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('f-name')?.focus(), 50);
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = editingType = null;
}

async function saveModal() {
  const type = editingType;
  const id   = editingId;
  let body = {};

  const val = id => document.getElementById(id)?.value ?? '';
  const num = id => Number(document.getElementById(id)?.value ?? 0);
  const sel = id => { const v = val(id); return v === '' ? null : Number(v); };

  if (type === 'skill') {
    const name = val('f-name').trim();
    if (!name) return toast('Name is required');
    body = { name, category: val('f-cat').trim(), progress: num('f-progress'), notes: val('f-notes').trim() };
  } else if (type === 'project') {
    const name = val('f-name').trim();
    if (!name) return toast('Name is required');
    body = { name, description: val('f-desc').trim(), status: val('f-status'), progress: num('f-progress') };
  } else if (type === 'todo') {
    const title = val('f-name').trim();
    if (!title) return toast('Title is required');
    body = { title, description: val('f-desc').trim(), priority: val('f-priority'), due_date: val('f-due') || null, project_id: sel('f-project'), skill_id: sel('f-skill') };
  } else if (type === 'note') {
    const title = val('f-name').trim();
    if (!title) return toast('Title is required');
    body = { title, content: val('f-desc').trim(), tags: val('f-tags').trim(), project_id: sel('f-project'), skill_id: sel('f-skill') };
  }

  try {
    const endpoint = `/${type}s${id ? '/' + id : ''}`;
    const method   = id ? 'PUT' : 'POST';
    const result   = await req(method, endpoint, body);

    if (id) {
      const idx = state[type + 's'].findIndex(x => x.id === id);
      if (idx >= 0) state[type + 's'][idx] = result;
    } else {
      state[type + 's'].unshift(result);
    }

    closeModal();
    toast(id ? 'Updated!' : 'Created!');

    if (type === 'skill')   renderSkills();
    if (type === 'project') renderProjects();
    if (type === 'todo')    renderTodos();
    if (type === 'note')    renderNotes();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

/* ── Delete ──────────────────────────────────────────────────────────────── */
function confirmDelete(type, id, name) {
  document.getElementById('confirm-msg').textContent = `Delete "${name}"? This cannot be undone.`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  confirmCb = async () => {
    try {
      await req('DELETE', `/${type}s/${id}`);
      state[type + 's'] = state[type + 's'].filter(x => x.id !== id);
      closeConfirm();
      toast('Deleted');
      if (type === 'skill')   renderSkills();
      if (type === 'project') renderProjects();
      if (type === 'todo')    renderTodos();
      if (type === 'note')    renderNotes();
    } catch (err) {
      toast('Error: ' + err.message);
    }
  };
}
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  confirmCb = null;
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ── Keyboard ────────────────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeConfirm();
    closeSidebar();
  }
});

/* ── Init ────────────────────────────────────────────────────────────────── */
document.querySelectorAll('[data-tab]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); switchTab(el.dataset.tab); });
});

document.getElementById('menu-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('confirm-yes').addEventListener('click', () => { if (confirmCb) confirmCb(); });

loadAll().then(() => {
  renderDashboard();
}).catch(err => {
  document.getElementById('content').innerHTML =
    `<div style="color:var(--red);padding:40px">Could not connect to the server.<br><small>${err.message}</small></div>`;
});
