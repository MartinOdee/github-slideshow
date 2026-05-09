const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tracker.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

// ── DB helpers ────────────────────────────────────────────────────────────────
function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] ?? null;
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
  const r = db.exec('SELECT last_insert_rowid()');
  return { lastInsertRowid: r[0]?.values[0][0] ?? null };
}

// ── Skills ────────────────────────────────────────────────────────────────────
app.get('/api/skills', (req, res) => {
  res.json(all('SELECT * FROM skills ORDER BY updated_at DESC'));
});

app.post('/api/skills', (req, res) => {
  const { name, category = '', progress = 0, notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = run(
    "INSERT INTO skills (name,category,progress,notes,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))",
    [name, category, progress, notes]
  );
  res.status(201).json(get('SELECT * FROM skills WHERE id=?', [r.lastInsertRowid]));
});

app.put('/api/skills/:id', (req, res) => {
  const id = Number(req.params.id);
  const skill = get('SELECT * FROM skills WHERE id=?', [id]);
  if (!skill) return res.status(404).json({ error: 'not found' });
  const { name, category, progress, notes } = req.body;
  run(
    "UPDATE skills SET name=?,category=?,progress=?,notes=?,updated_at=datetime('now') WHERE id=?",
    [name ?? skill.name, category ?? skill.category, progress ?? skill.progress, notes ?? skill.notes, id]
  );
  res.json(get('SELECT * FROM skills WHERE id=?', [id]));
});

app.delete('/api/skills/:id', (req, res) => {
  run('DELETE FROM skills WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ── Projects ──────────────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  res.json(all('SELECT * FROM projects ORDER BY updated_at DESC'));
});

app.post('/api/projects', (req, res) => {
  const { name, description = '', status = 'active', progress = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = run(
    "INSERT INTO projects (name,description,status,progress,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))",
    [name, description, status, progress]
  );
  res.status(201).json(get('SELECT * FROM projects WHERE id=?', [r.lastInsertRowid]));
});

app.put('/api/projects/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = get('SELECT * FROM projects WHERE id=?', [id]);
  if (!p) return res.status(404).json({ error: 'not found' });
  const { name, description, status, progress } = req.body;
  run(
    "UPDATE projects SET name=?,description=?,status=?,progress=?,updated_at=datetime('now') WHERE id=?",
    [name ?? p.name, description ?? p.description, status ?? p.status, progress ?? p.progress, id]
  );
  res.json(get('SELECT * FROM projects WHERE id=?', [id]));
});

app.delete('/api/projects/:id', (req, res) => {
  run('DELETE FROM projects WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ── Todos ─────────────────────────────────────────────────────────────────────
app.get('/api/todos', (req, res) => {
  res.json(all(`
    SELECT t.*, p.name AS project_name, s.name AS skill_name
    FROM todos t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN skills s ON t.skill_id = s.id
    ORDER BY t.done ASC,
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC
  `));
});

app.post('/api/todos', (req, res) => {
  const { title, description = '', priority = 'medium', due_date = null, project_id = null, skill_id = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const r = run(
    "INSERT INTO todos (title,description,priority,due_date,project_id,skill_id,done,created_at,updated_at) VALUES (?,?,?,?,?,?,0,datetime('now'),datetime('now'))",
    [title, description, priority, due_date, project_id, skill_id]
  );
  res.status(201).json(get('SELECT * FROM todos WHERE id=?', [r.lastInsertRowid]));
});

app.put('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  const t = get('SELECT * FROM todos WHERE id=?', [id]);
  if (!t) return res.status(404).json({ error: 'not found' });
  const { title, description, done, priority, due_date, project_id, skill_id } = req.body;
  run(
    "UPDATE todos SET title=?,description=?,done=?,priority=?,due_date=?,project_id=?,skill_id=?,updated_at=datetime('now') WHERE id=?",
    [
      title ?? t.title,
      description ?? t.description,
      done !== undefined ? (done ? 1 : 0) : t.done,
      priority ?? t.priority,
      due_date !== undefined ? due_date : t.due_date,
      project_id !== undefined ? project_id : t.project_id,
      skill_id !== undefined ? skill_id : t.skill_id,
      id
    ]
  );
  res.json(get('SELECT * FROM todos WHERE id=?', [id]));
});

app.delete('/api/todos/:id', (req, res) => {
  run('DELETE FROM todos WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ── Notes ─────────────────────────────────────────────────────────────────────
app.get('/api/notes', (req, res) => {
  res.json(all(`
    SELECT n.*, p.name AS project_name, s.name AS skill_name
    FROM notes n
    LEFT JOIN projects p ON n.project_id = p.id
    LEFT JOIN skills s ON n.skill_id = s.id
    ORDER BY n.updated_at DESC
  `));
});

app.post('/api/notes', (req, res) => {
  const { title, content = '', tags = '', project_id = null, skill_id = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const r = run(
    "INSERT INTO notes (title,content,tags,project_id,skill_id,created_at,updated_at) VALUES (?,?,?,?,?,datetime('now'),datetime('now'))",
    [title, content, tags, project_id, skill_id]
  );
  res.status(201).json(get('SELECT * FROM notes WHERE id=?', [r.lastInsertRowid]));
});

app.put('/api/notes/:id', (req, res) => {
  const id = Number(req.params.id);
  const n = get('SELECT * FROM notes WHERE id=?', [id]);
  if (!n) return res.status(404).json({ error: 'not found' });
  const { title, content, tags, project_id, skill_id } = req.body;
  run(
    "UPDATE notes SET title=?,content=?,tags=?,project_id=?,skill_id=?,updated_at=datetime('now') WHERE id=?",
    [
      title ?? n.title,
      content ?? n.content,
      tags ?? n.tags,
      project_id !== undefined ? project_id : n.project_id,
      skill_id !== undefined ? skill_id : n.skill_id,
      id
    ]
  );
  res.json(get('SELECT * FROM notes WHERE id=?', [id]));
});

app.delete('/api/notes/:id', (req, res) => {
  run('DELETE FROM notes WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({
    skills:          get('SELECT COUNT(*) AS c FROM skills').c,
    skills_avg:      Math.round(get('SELECT AVG(progress) AS a FROM skills').a || 0),
    projects:        get('SELECT COUNT(*) AS c FROM projects').c,
    projects_active: get("SELECT COUNT(*) AS c FROM projects WHERE status='active'").c,
    todos_total:     get('SELECT COUNT(*) AS c FROM todos').c,
    todos_done:      get('SELECT COUNT(*) AS c FROM todos WHERE done=1').c,
    notes:           get('SELECT COUNT(*) AS c FROM notes').c,
  });
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      category   TEXT DEFAULT '',
      progress   INTEGER DEFAULT 0,
      notes      TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      status      TEXT DEFAULT 'active',
      progress    INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS todos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      done        INTEGER DEFAULT 0,
      priority    TEXT DEFAULT 'medium',
      due_date    TEXT DEFAULT NULL,
      project_id  INTEGER,
      skill_id    INTEGER,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      content    TEXT DEFAULT '',
      tags       TEXT DEFAULT '',
      project_id INTEGER,
      skill_id   INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  save();

  app.listen(PORT, () => console.log(`Tracker running on http://localhost:${PORT}`));
}

start().catch(console.error);
