# Skill & Project Tracker

A multi-device web app to track your skill progress, projects, todos, and notes.

## Features

- **Skills** — track progress (0–100%), category, and notes for each skill
- **Projects** — manage status (active/paused/completed/cancelled) and progress
- **Todos** — priority levels, due dates, link to a project or skill
- **Notes** — free-form notes with tags, linked to projects or skills
- **Dashboard** — stats overview, upcoming todos, recent notes, skill bars

## Setup

```bash
cd tracker-app
npm install
npm start
```

Open **http://localhost:3000** in any browser on your network.

## Multi-device access

To access from other devices on your home/office network:

1. Find your machine's local IP:
   - macOS/Linux: `ip addr` or `ifconfig`
   - Windows: `ipconfig`
2. Open `http://<your-ip>:3000` on any phone, tablet or other computer.

## Cloud deployment (access anywhere)

Deploy to [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io) — all have free tiers. Set `DB_PATH` env var to a persistent volume path.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | HTTP port   |
| `DB_PATH`| `./tracker.db` | SQLite file path |
