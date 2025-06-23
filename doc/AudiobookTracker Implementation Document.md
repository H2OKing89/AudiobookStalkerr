# **AudioStacker Implementation Document**

---

## **I. Overview & Goals**

**Purpose:**
Automate searching for, tracking, and notifying about new audiobook releases from Audible (or other sources), with efficient caching and notification control, all in a maintainable, modular, and future-proof way.

**Primary Goals:**

* Define and monitor a dynamic list of wanted audiobooks (by series/author/title/publisher).
* Periodically search Audible’s API for new releases.
* Cache results to avoid duplicate API hits and notifications.
* Notify users (Pushover, Discord, etc.) when new matches are found.
* Make it easy to expand to new search sources or notification methods.

**Big picture:**
If Sonarr and an anime waifu had a baby for audiobooks, this would be it.

---

## **II. Core Logic/Workflow (TL;DR)**

1. **Load config and audiobook search list** (YAML/JSON).
2. **Initialize database/cache** (SQLite).
3. **For each search entry** (by author/title/publisher/series):

   * Query Audible’s API (with smart params).
   * Parse results, filtering out podcasts, duplicates, and non-matches.
   * For each candidate:

     * If not seen (or updated), insert/update in DB.
     * If not notified, send notification and update cache.
4. **Log everything** for troubleshooting and accountability.
5. **Repeat on schedule** (cron, Home Assistant, or as a daemon).

---

## **III. Project Breakdown (MVP)**

### **A. Config/Data**

* `config/config.yaml` – App settings, API keys, etc.
* `config/audiobooks.yaml` – List of books/series/authors/publishers to watch.

### **B. Core Modules**

* `main.py` – Entry point, main logic, orchestration.
* `audible.py` – Handles Audible API querying, normalization, error handling.
* `database.py` – SQLite logic: create tables, upserts, cache checking, querying.
* `utils.py` – Misc helpers (string cleanup, logging, date handling).
* `notify/notify.py` – Notification orchestration logic.
* `notify/pushover.py` – Pushover send logic.
* *(Future: Discord, email, etc.)*

### **C. Database**

* Table: `audiobooks`

  * Fields: asin, title, author(s), narrator(s), publisher, series, release\_date, last\_checked, notified (plus room for expansion).
* All cache/notification state managed here.

### **D. Core Features (MVP)**

* **Efficient search**: Query API with smart filters; handle max-results.
* **Filtering:** Only process audiobooks (skip podcasts, etc.).
* **Deduplication:** Don’t re-notify about the same book.
* **Notification:** At least Pushover, with clear formatting and direct links.
* **Logging:** Write all major events/actions to `logs/` for debugging.

---

## **IV. Step-by-Step Build Plan**

**Step 1:**

* Set up project structure and config files.
* Build initial `database.py` with table creation and basic upsert/check.

**Step 2:**

* Build `audible.py` to query API and return normalized book dicts.
* Write helpers in `utils.py` for string/date cleanups.

**Step 3:**

* Write `main.py` to:

  * Load config & wanted list.
  * Query Audible for each entry.
  * Filter, process, and cache.
  * Notify if needed.

**Step 4:**

* Build notification subsystem (`notify/notify.py`, `pushover.py`).
* Test end-to-end notification flow.

**Step 5:**

* Build logging.
* Add CLI options for dry-run, debug, etc.

**Step 6:**

* Test with several books, authors, and edge cases.
* Document everything (README, config examples, API references).

**Step 7 (Optional):**

* Add support for other notification channels (Discord, email, Gotify).
* Add advanced filtering, tag-based watchlists, or web frontend for results.

---

## **V. Nice-to-Have Future Features**

* Web UI for adding/removing wanted books (Flask/FastAPI).
* Advanced matching (fuzzy logic, confidence scoring, language/region support).
* Auto-download integration with qBittorrent or other tools.
* Integration with metadata sources (Goodreads, etc.).
* Export/reporting for found/notified books.

---

## **VI. Roles and Responsibilities**

* **You (Quentin):**

  * Chief Architect, Debugger, and Meme Lord
  * All coding decisions and notification flavor
* **ChatGPT:**

  * Rubber duck, code generator, and high-octane cheerleader

---

## **VII. Next Steps**

* Confirm and commit project skeleton
* Begin with database and config loader
* Move through core logic in tight, testable chunks

---
