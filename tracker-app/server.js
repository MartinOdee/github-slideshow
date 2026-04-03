const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tracker.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Database setup ────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS skills (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    category  TEXT DEFAULT '',
    progress  INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    notes     TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    status      TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','cancelled')),
    progress    INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    done        INTEGER DEFAULT 0,
    priority    TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
    due_date    TEXT DEFAULT NULL,
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    skill_id    INTEGER REFERENCES skills(id) ON DELETE SET NULL,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    content    TEXT DEFAULT '',
    tags       TEXT DEFAULT '',
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    skill_id   INTEGER REFERENCES skills(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Helper ────────────────────────────────────────────────────────────────────
const touch = (table, id) =>
  db.prepare(`UPDATE ${table} SET updated_at=datetime('now') WHERE id=?`).run(id);

// ── Skills ────────────────────────────────────────────────────────────────────
app.get('/api/skills', (req, res) => {
  const rows = db.prepare('SELECT * FROM skills ORDER BY updated_at DESC').all();
  res.json(rows);
});

app.post('/api/skills', (req, res) => {
  const { name, category = '', progress = 0, notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare(
    'INSERT INTO skills (name,category,progress,notes) VALUES (?,?,?,?)'
  ).run(name, category, progress, notes);
  res.status(201).json(db.prepare('SELECT * FROM skills WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/skills/:id', (req, res) => {
  const { name, category, progress, notes } = req.body;
  const id = req.params.id;
  const skill = db.prepare('SELECT * FROM skills WHERE id=?').get(id);
  if (!skill) return res.status(404).json({ error: 'not found' });
  db.prepare(
    `UPDATE skills SET name=?,category=?,progress=?,notes=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    name ?? skill.name,
    category ?? skill.category,
    progress ?? skill.progress,
    notes ?? skill.notes,
    id
  );
  res.json(db.prepare('SELECT * FROM skills WHERE id=?').get(id));
});

app.delete('/api/skills/:id', (req, res) => {
  db.prepare('DELETE FROM skills WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Projects ──────────────────────────────────────────────────────────────────
app.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(rows);
});

app.post('/api/projects', (req, res) => {
  const { name, description = '', status = 'active', progress = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare(
    'INSERT INTO projects (name,description,status,progress) VALUES (?,?,?,?)'
  ).run(name, description, status, progress);
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/projects/:id', (req, res) => {
  const { name, description, status, progress } = req.body;
  const id = req.params.id;
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(id);
  if (!p) return res.status(404).json({ error: 'not found' });
  db.prepare(
    `UPDATE projects SET name=?,description=?,status=?,progress=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    name ?? p.name,
    description ?? p.description,
    status ?? p.status,
    progress ?? p.progress,
    id
  );
  res.json(db.prepare('SELECT * FROM projects WHERE id=?').get(id));
});

app.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Todos ─────────────────────────────────────────────────────────────────────
app.get('/api/todos', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.name AS project_name, s.name AS skill_name
    FROM todos t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN skills s ON t.skill_id = s.id
    ORDER BY t.done ASC, CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST
  `).all();
  res.json(rows);
});

app.post('/api/todos', (req, res) => {
  const { title, description = '', priority = 'medium', due_date = null, project_id = null, skill_id = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const r = db.prepare(
    'INSERT INTO todos (title,description,priority,due_date,project_id,skill_id) VALUES (?,?,?,?,?,?)'
  ).run(title, description, priority, due_date, project_id, skill_id);
  res.status(201).json(db.prepare('SELECT * FROM todos WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/todos/:id', (req, res) => {
  const id = req.params.id;
  const t = db.prepare('SELECT * FROM todos WHERE id=?').get(id);
  if (!t) return res.status(404).json({ error: 'not found' });
  const { title, description, done, priority, due_date, project_id, skill_id } = req.body;
  db.prepare(
    `UPDATE todos SET title=?,description=?,done=?,priority=?,due_date=?,project_id=?,skill_id=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    title ?? t.title,
    description ?? t.description,
    done !== undefined ? (done ? 1 : 0) : t.done,
    priority ?? t.priority,
    due_date !== undefined ? due_date : t.due_date,
    project_id !== undefined ? project_id : t.project_id,
    skill_id !== undefined ? skill_id : t.skill_id,
    id
  );
  res.json(db.prepare('SELECT * FROM todos WHERE id=?').get(id));
});

app.delete('/api/todos/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Notes ─────────────────────────────────────────────────────────────────────
app.get('/api/notes', (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, p.name AS project_name, s.name AS skill_name
    FROM notes n
    LEFT JOIN projects p ON n.project_id = p.id
    LEFT JOIN skills s ON n.skill_id = s.id
    ORDER BY n.updated_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/notes', (req, res) => {
  const { title, content = '', tags = '', project_id = null, skill_id = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const r = db.prepare(
    'INSERT INTO notes (title,content,tags,project_id,skill_id) VALUES (?,?,?,?,?)'
  ).run(title, content, tags, project_id, skill_id);
  res.status(201).json(db.prepare('SELECT * FROM notes WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const n = db.prepare('SELECT * FROM notes WHERE id=?').get(id);
  if (!n) return res.status(404).json({ error: 'not found' });
  const { title, content, tags, project_id, skill_id } = req.body;
  db.prepare(
    `UPDATE notes SET title=?,content=?,tags=?,project_id=?,skill_id=?,updated_at=datetime('now') WHERE id=?`
  ).run(
    title ?? n.title,
    content ?? n.content,
    tags ?? n.tags,
    project_id !== undefined ? project_id : n.project_id,
    skill_id !== undefined ? skill_id : n.skill_id,
    id
  );
  res.json(db.prepare('SELECT * FROM notes WHERE id=?').get(id));
});

app.delete('/api/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({
    skills:           db.prepare('SELECT COUNT(*) AS c FROM skills').get().c,
    skills_avg:       Math.round(db.prepare('SELECT AVG(progress) AS a FROM skills').get().a || 0),
    projects:         db.prepare('SELECT COUNT(*) AS c FROM projects').get().c,
    projects_active:  db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status='active'").get().c,
    todos_total:      db.prepare('SELECT COUNT(*) AS c FROM todos').get().c,
    todos_done:       db.prepare('SELECT COUNT(*) AS c FROM todos WHERE done=1').get().c,
    notes:            db.prepare('SELECT COUNT(*) AS c FROM notes').get().c,
  });
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Tracker running on http://localhost:${PORT}`));
