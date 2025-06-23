# AudioStacker **Implementation Document**

---

## I. Overview & Goals

**Purpose**
Automate the discovery, tracking, and notification of new audiobook releases on Audible (or other sources). Provide efficient caching and rate‑limited API access in a maintainable, modular, and future‑proof code‑base.

**Primary goals**

1. Watch a dynamic list of audiobooks (by series, author, title, publisher).
2. Query Audible daily for new or updated items.
3. Cache results to avoid duplicate API calls and duplicate notifications.
4. Send daily digests via Pushover, Discord, and/or e‑mail.
5. Remain easily extensible for new data sources and notification channels.

> *If Sonarr and an anime waifu had a baby for audiobooks, this would be it.*

---

## II. Daily Workflow — TL;DR

1. **Load** `config.yaml` and `audiobooks.yaml` (wanted list).
2. **Init** SQLite cache (create tables if missing).
3. **Loop** through each watch‑item:
      • Query Audible (auto‑paginate ≤50 results/page).
      • Filter out podcasts, duplicates, and releases older than *X* days (configurable).
      • For every candidate: insert/update DB → send notification if not yet flagged.
4. **Log** all actions & errors (JSON to `logs/`).
5. **Exit.** Run once per day via cron / systemd / Home Assistant.

---

## III. Project Breakdown (MVP)

\### A. Config & Data

* **`config/config.yaml`** — runtime settings & secrets
* **`config/audiobooks.yaml`** — watch‑list of titles/series/authors

| Setting                         | Default | Cap      | Rule                                      |
| ------------------------------- | ------- | -------- | ----------------------------------------- |
| `notification_suppression_days` | 7 days  | 30 days  | Must be ≤ `cache_cleanup_days`            |
| `cache_cleanup_days`            | 90 days | 365 days | Must be ≥ `notification_suppression_days` |

If a user mis‑configures the two values, AudioStacker automatically bumps `cache_cleanup_days` to `suppression + 1` and logs a warning.

* **Rate‑limits:** hard‑coded constants per endpoint; enforced via token‑bucket decorator.

\### B. Core Modules

```
src/audiostacker/
 ├── main.py          # orchestrator / CLI
 ├── audible.py       # API client & normaliser
 ├── database.py      # SQLite helpers & cache
 ├── utils.py         # logging, rate‑limit, misc helpers
 └── notify/
      ├── __init__.py
      ├── notify.py   # dispatcher
      └── pushover.py # Pushover channel
```

*(Future: discord.py, email.py, gotify.py, etc.)*

\### C. Database Schema

```sql
CREATE TABLE IF NOT EXISTS audiobooks (
    asin           TEXT PRIMARY KEY,
    title          TEXT,
    author         TEXT,
    narrator       TEXT,
    publisher      TEXT,
    series         TEXT,
    series_number  TEXT,
    release_date   TEXT,
    last_checked   TIMESTAMP,
    notified       INTEGER DEFAULT 0 CHECK (notified IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_author   ON audiobooks(author);
CREATE INDEX IF NOT EXISTS idx_series   ON audiobooks(series, series_number);
CREATE INDEX IF NOT EXISTS idx_release  ON audiobooks(release_date);
```

\### D. Core Features

* Efficient search (auto‑paginate, 50‑item API cap).
* Filters: skip podcasts via `content_type` / `content_delivery_type`.
* Deduplication: DB cache + `notification_suppression_days`.
* Notifications: Pushover daily digest (dry‑run prints only).
* Config validation & structured logging.

---

## IV. Step‑by‑Step Build Plan

1. **Skeleton & DB**
      • Repo layout & `.editorconfig` + Black / ruff.
      • Implement `database.py`; create DB; add sample `audiobooks.yaml`.
2. **Audible client**
      • Build `audible.py`; helpers in `utils.py`.
      • Unit‑test with canned JSON + mocked 429 headers.
3. **Main orchestrator** (`main.py`)
      • Load configs → query → filter → cache → notify (honour `--dry-run`).
4. **Notification layer**
      • Implement Pushover, wire dispatcher, E2E test.
5. **Logging & CLI**
      • JSON logs, audit log; CLI flags `--debug` `--once`.
6. **Hardening & docs** – edge‑case tests, README, examples.
7. *(Stretch)* Discord/email channels, fuzzy matching, web UI.

---

## V. Future Enhancements

* Flask/FastAPI dashboard for watch‑list edits.
* Auto‑download hooks (qBittorrent, SABnzbd).
* Metadata enrichment via Goodreads/Kagi.
* Async DB (`aiosqlite`) for very large watch‑lists.

---

## Notification Formats

\### Daily Pushover Digest

| Field     | Example                                                                  | Purpose              |
| --------- | ------------------------------------------------------------------------ | -------------------- |
| Title     | `Mushoku Tensei Vol 26`                                                  | Quick phone banner   |
| Body      | `Author: Rifujin na Magonote\nNarrator: Cliff Kirk\nRelease: 2025‑06‑12` | Core metadata        |
| URL       | `https://www.audible.com/pd/<ASIN>`                                      | One‑tap Audible link |
| URL Title | `Open on Audible`                                                        | Friendly label       |
| Priority  | `-1` (batch) / `0` (immediate)                                           | Throttle control     |

*One notification per day.* If >20 matches, include first 20 lines then “…and X more”.

\### Example Pushover JSON

```json
{
  "token": "<APP_TOKEN>",
  "user": "<USER_KEY>",
  "title": "3 new audiobooks matched!",
  "message": "Mushoku Tensei Vol 26 — 2025‑06‑12\nReincarnated as a Sword Vol 11 — 2025‑06‑20\nClassroom of the Elite Y2 Vol 9.5 — 2025‑05‑08",
  "url": "https://www.audible.com/pd/B0DK2GS3LZ",
  "url_title": "Open on Audible",
  "priority": 0
}
```

\### HTML Email Digest

```html
<h2>AudioStacker Daily Digest – 2025‑06‑21</h2>
<ul>
  <li><strong>Mushoku Tensei Vol 26</strong> – 2025‑06‑12<br/>
      Author: Rifujin na Magonote • Narrator: Cliff Kirk<br/>
      <a href="https://www.audible.com/pd/B0DK2GS3LZ">Open on Audible</a></li>
  <li><strong>Reincarnated as a Sword Vol 11</strong> – 2025‑06‑20<br/>
      Author: Yuu Tanaka • Narrator: Josh Hurley<br/>
      <a href="https://www.audible.com/pd/B0FDVLJ8TN">Open on Audible</a></li>
  <li>…and 8 more</li>
</ul>
```

*Subject:* **AudioStacker – 10 new audiobooks (2025‑06‑21)**

\### Discord Embed Digest
Discord limits: 1 embed ≈ 6000 chars, 256‑char title, 4096‑char description, 25 fields, max 10 embeds per message.

* First embed title: *AudioStacker – Daily Digest (YYYY‑MM‑DD)*.
* Each book = a field (Name = Title & date, Value = `Author • Narrator • [Open Audible](URL)`).
* If >25 books, send second embed or append `…and X more` field.

---

## VI. Error Handling & Resilience

* **API** – retry w/ exponential back‑off; trap HTTP 429.
* **Notifications** – queue & retry; dedupe.
* **Main loop** – catch‑all so one failure doesn’t stop execution.

---

## VII. Indexing & Maintenance

* `VACUUM` + prune rows older than `cache_cleanup_days` & notified = 1.
* Warn if database exceeds threshold size.

---

## VIII. Testing & CI/CD

* Pytest unit + integration; GitHub Actions for lint + tests.

---

## IX. Logging & Observability

* JSON logs → `logs/audiostacker.log`; separate audit log for notifications.

---

## X. Security Notes

* Secrets via env‑vars; never log raw secrets.
* Sanitise all external data.
* Optional: central secrets manager.

---

## XI. Roles & Credits

* **Quentin** – chief architect, debugger, meme lord.
* **ChatGPT** – rubber‑duck, code generator, hype machine.

---

## XII. Next Immediate Tasks

1. Commit this doc (`doc/implementation.md`).
2. Scaffold repo + `.gitignore` (`logs/`, `.venv/`, `*.pyc`).
3. Build `database.py`; run initial unit test.
4. Prototype first Audible query with mock data.

---

## XIII. Logic Variations & Tunables (Parking‑Lot)

* **Scheduling:** hourly mode (`notification_suppression_hours`).
* **Notification:** favourite‑author bypass; Friday‑digest.
* **Cache:** Redis cluster; SHA‑1 diff for metadata edits.
* **Storage:** Postgres w/ JSONB for analytics.
* **Matching:** Levenshtein / language filtering.
* **Automation Hooks:** downloader triggers, taser.

> Ship fast, ship often, iterate.
> *This document is a living artifact. Expect changes as we build and learn.*