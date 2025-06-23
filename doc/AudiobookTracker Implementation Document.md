# **AudioStacker Implementation Document**

---

## **I. Overview & Goals**

**Purpose:**
Automate searching for, tracking, and notifying about new audiobook releases from Audible (or other sources), with efficient caching and notification control, all in a maintainable, modular, and future‑proof way.

**Primary Goals:**

* Define and monitor a dynamic list of wanted audiobooks (by series/author/title/publisher).
* Periodically search Audible’s API for new releases.
* Cache results to avoid duplicate API hits and notifications.
* Notify users (Pushover, Discord, etc.) when new matches are found.
* Make it easy to expand to new search sources or notification methods.

**Big picture:**
If Sonarr and an anime waifu had a baby for audiobooks, this would be it.

---

## **II. Core Logic / Workflow (TL;DR)**

1. **Load** config and audiobook search list (YAML/JSON).
2. **Initialize** database/cache (SQLite).
3. **Iterate** through each search entry (author / title / publisher / series):

   * Query Audible’s API with smart params.
   * Parse results, filtering out podcasts, duplicates, non‑matches, and back‑catalog older than *X* days (configurable).
   * For every candidate:

     * If unseen or updated → insert/update DB.
     * If not yet notified → send notification, mark as notified.
4. **Log** every significant action/error.
5. \*\*Trigger **once per day**, then exit. Schedule via cron, Home Assistant automation, or systemd timer – no long‑running daemon needed.).

---

## **III. Project Breakdown (MVP)**

### **A. Config / Data**

`config/config.yaml` — runtime settings & secrets
`config/audiobooks.yaml` — watch‑list of books/series/authors/publishers

Key settings:

* `notification_suppression_days` (default **7**, cap 30) – must be **≤** `cache_cleanup_days`.

* `cache_cleanup_days` (default **90**, cap 365) – must be **≥** `notification_suppression_days`.

* Code enforcement: if user sets `notification_suppression_days` higher than `cache_cleanup_days`, AudioStacker auto‑bumps `cache_cleanup_days` to `suppression + 1` and logs a warning.

* *Hard‑coded* API rate‑limit constants per endpoint (token‑bucket / decorator).

* `notification_suppression_days` (default 10, cap 30).

* `cache_cleanup_days` (default 10, cap 30).

* *Hard‑coded* API rate‑limit constants per endpoint (token‑bucket / decorator).

### **B. Core Modules**

```
src/audiostacker/
 ├── main.py          # orchestration / CLI
 ├── audible.py       # API client & normalizer
 ├── database.py      # SQLite helpers & cache layer
 ├── utils.py         # misc helpers (dates, logging, rate‑limit)
 └── notify/
      ├── __init__.py
      ├── notify.py   # dispatcher
      └── pushover.py # Pushover channel
```

*(Future: discord.py, email, gotify, etc.)*

### **C. Database Schema**

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
-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_author   ON audiobooks(author);
CREATE INDEX IF NOT EXISTS idx_series   ON audiobooks(series, series_number);
CREATE INDEX IF NOT EXISTS idx_release  ON audiobooks(release_date);
-- Indexes for speed
CREATE INDEX IF NOT EXISTS idx_author   ON audiobooks(author);
CREATE INDEX IF NOT EXISTS idx_series   ON audiobooks(series, series_number);
CREATE INDEX IF NOT EXISTS idx_release  ON audiobooks(release_date);
```

### **D. Core Features (MVP)**

* **Efficient search:** handle 50‑result API limit, auto‑paginate.
* **Filtering:** drop podcasts via `content_type` / `content_delivery_type`.
* **Deduplication & cache:** avoid repeat API hits & notifications.
* **Notification:** Pushover with direct link; *dry‑run* mode prints only.
* **Config validation:** fail fast on malformed YAML.
* **Structured logging:** to `logs/`, JSON or key‑value.

---

## **IV. Step‑by‑Step Build Plan**

\*\*Step 1 – Skeleton & DB
∙ Create repo layout.
∙ Implement `database.py` (create table + upsert).
∙ Add sample `audiobooks.yaml` (≥3 entries).
∙ Commit a `.editorconfig` and enable Black/ruff config for consistent style.

Step 2 – Audible Client
∙ Build `audible.py` (query & normalize).
∙ Add helpers in `utils.py` (rate‑limit decorator, date utils).
∙ Unit‑test with canned JSON.
∙ **Mock API 429/Rate‑Limit headers** to verify back‑off logic.

**Step 3 – Main Orchestrator**
∙ Load configs.
∙ Loop watch‑list → query → filter → cache → notify.
∙ Respect dry‑run & log levels.

**Step 4 – Notification Layer**
∙ Implement `notify/pushover.py`.
∙ Wire `notify.py` dispatcher.
∙ End‑to‑end test.

**Step 5 – Logging & CLI**
∙ Add structured logging, audit log.
∙ CLI flags: `--dry-run`, `--debug`, `--once`.

**Step 6 – Hardening & Docs**
∙ Edge‑case tests (multi‑author, API 429, etc.).
∙ Write README + config examples + API reference.

**Step 7 (Stretch)**
∙ Add Discord/email channels.
∙ Tag‑based watch‑lists, fuzzy matching, web UI.

---

## **V. Future Candy**

* Flask/FastAPI dashboard (add/remove watch‑items).
* Auto‑download integration (qBittorrent, SABnzbd).
* Goodreads/Kagi metadata enrichment.
* Async DB (aiosqlite) for 1k+ books.

---

## **Notification Format & Batching**

| Field                 | Example (Pushover)                               | Purpose                             |
| --------------------- | ------------------------------------------------ | ----------------------------------- |
| **Title**             | `Mushoku Tensei Vol 26`                          | Quick glance in phone‑banner        |
| **Message body**      | \`Author: Rifujin na Magonote                    |                                     |
| Narrator: Cliff Kirk  |                                                  |                                     |
| Release: 2025‑06‑12\` | Core metadata                                    |                                     |
| **URL**               | `https://www.audible.com/pd/<ASIN>` (first item) | Quick jump – no local server needed |
| **URL Title**         | `Open on Audible`                                | Friendly label                      |
| **Priority**          | `-1` (batch) / `0` (immediate)                   | Allow user throttle                 |

### Batching Rules

* \*\***Daily digest**: collect all new books in the run and send a single notification.
* \*\*If more than 20 items, send the first 20 lines then “...and X more” (no extra URL needed).
* \*\*One digest per daily run keeps within notification limits – no intra‑day batching necessary.

### Example Pushover Payload (JSON)

````json
{
  "token": "<APP_TOKEN>",
  "user": "<USER_KEY>",
  "title": "3 new audiobooks matched!",
  "message": "Mushoku Tensei Vol 26 — 2025‑06‑12
Reincarnated as a Sword Vol 11 — 2025‑06‑20
Classroom of the Elite Y2 Vol 9.5 — 2025‑05‑08",
  "url": "https://www.audible.com/pd/B0DK2GS3LZ",  // first book’s ASIN
  "url_title": "Open on Audible",
  "priority": 0
}
```json

````

**Email Digest Example (HTML)**

```html
<h2>AudioStacker Daily Digest – 2025‑06‑21</h2>
<ul>
  <li>
    <strong>Mushoku Tensei Vol 26</strong> – 2025‑06‑12<br/>
    Author: Rifujin na Magonote • Narrator: Cliff Kirk<br/>
    <a href="https://www.audible.com/pd/B0DK2GS3LZ">Open on Audible</a>
  </li>
  <li>
    <strong>Reincarnated as a Sword Vol 11</strong> – 2025‑06‑20<br/>
    Author: Yuu Tanaka • Narrator: Josh Hurley<br/>
    <a href="https://www.audible.com/pd/B0FDVLJ8TN">Open on Audible</a>
  </li>
  <li>
    …and 8 more
  </li>
</ul>
```

* Subject line: **“AudioStacker – 10 new audiobooks found (2025‑06‑21)”**
* Body: HTML list with title (link), author, narrator, release date.
* If >20 items, truncate list and add “…and X more” with a CSV attachment of full results.

### Discord Embed Digest

**Discord limits to 1 embed ≈ 6000 chars – max 256‑char title, 4096‑char description, 25 fields (each 1024) and 10 embeds per message.**

Strategy:

* Build one embed titled `AudioStacker – Daily Digest (YYYY‑MM‑DD)`.
* Put first **10–12** books as individual *fields* (Name = Title, Value = `Author •  Release   [Open Audible](URL)`).
* If >12 items, send multiple embeds (but never >10 embeds in one message) – or fall back to "…and X more" in final field.

```json
{
  "embeds": [
    {
      "title": "AudioStacker – Daily Digest (2025‑06‑21)",
      "description": "10 new audiobooks matched!",
      "color": 7506394,
      "fields": [
        {
          "name": "Mushoku Tensei Vol 26 (2025‑06‑12)",
          "value": "Rifujin na Magonote • Cliff Kirk
[Open Audible](https://www.audible.com/pd/B0DK2GS3LZ)",
          "inline": false
        },
        {
          "name": "Reincarnated as a Sword Vol 11 (2025‑06‑20)",
          "value": "Yuu Tanaka • Josh Hurley
[Open Audible](https://www.audible.com/pd/B0FDVLJ8TN)",
          "inline": false
        }
        // up to 25 fields total
      ]
    }
  ]
}
```

*Embed color optional. If more than 25 books, create additional embeds or truncate with a final field:*
`{"name": "…and 8 more", "value": "See Email digest for full list", "inline": false}`

---

## **VI. Error Handling & Resilience**

* **API:** retry w/ exponential back‑off, specifically trap HTTP 429.
* **Notifications:** queue & retry, dedupe on repeated fails.
* **Robust loop:** catch‑all around each watch item so one failure ≠ stop‑the‑world.

---

## **VII. Indexing & Maintenance**

* Index `asin`, `author`, `series`, `release_date`.
* Schedule `VACUUM` + prune old rows after `cache_cleanup_days`.
* Warn if DB > configurable size.

---

## **VIII. Testing & CI/CD**

* Pytest unit + integration suites.
* GitHub Actions: lint (ruff), tests, packaging.

---

## **IX. Logging & Observability**

* JSON logs → `logs/audiostacker.log`.
* Audit log entry for every notification: ASIN, timestamp, channel.

---

## \*\*X. Security Notes

* Store secrets via env vars (`AUDIOSTACKER_PUSHOVER_TOKEN`, etc.).
* **Mask secrets in logs** – never dump raw env values.
* Sanitize all API inputs/outputs.
* Optional: integrate with 1Password CLI / Vault for prod.

---

## **XI. Roles & Credits**

* **Quentin** – Chief architect, debugger, meme lord.
* **ChatGPT** – Rubber‑duck, code generator, hype machine.

---

## **XII. Next Immediate Tasks**

1. Commit this doc (`doc/implementation.md`).
2. Scaffold repo folders & `.gitignore` (include `logs/`, `.venv/`, `*.pyc`).
3. Implement `database.py` → run unit test to create DB file.
4. Hack in first Audible query with fake data to prove the loop.

\*\*

## **XII. Logic Variations & Tunables (Ideas Parking‑Lot)**

* **Scheduling**

  * Hourly run with `notification_suppression_hours` instead of daily.
  * Cloud cron (GitHub Actions, cron‑hub) for server‑less triggers.
* **Notification Logic**

  * “Favorite author” bypass window.
  * Weekend digest that aggregates Mon‑Fri.
* **Cache Strategy**

  * Redis backend for clustered deployments.
  * SHA‑1 hash diff to detect metadata edits.
* **Rate‑Limit Handling**

  * Central job queue that sleeps after consecutive 429s.
* **Storage Upgrades**

  * PostgreSQL migration path, raw JSON BLOB column for analytics.
* **Matching Algorithms**

  * Levenshtein/Jaro‑Winkler fuzzy on titles; language filtering.
* **Automation Hooks**

  * Post‑match call to downloader or taser.

*(Optional ideas for future sprints – not in MVP scope.)*

Ship fast, ship often, iterate.\*\*
