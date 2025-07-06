# Audiobook Stalkerr

Audiobook Stalkerr is a modern, open-source tool for tracking, visualizing, and getting notified about upcoming audiobook releases from Audible. It features a beautiful web UI, multi-channel notifications, calendar export, and powerful configuration for serious audiobook fans.

---

## 🚀 Features

- **Web Dashboard**: Browse, search, and filter upcoming releases in a responsive, mobile-friendly web UI
- **Author & Series Tracking**: Automatically search Audible for new audiobooks by your favorite authors and series
- **Multi-Match Processing**: Identifies and processes all matching audiobooks above a confidence threshold (multiple volumes, editions, etc.)
- **Notifications**: Get notified via Pushover, Discord, and Email when new releases are found
- **Calendar Integration**: Export upcoming releases as iCalendar (.ics) files for your calendar app
- **Configurable**: YAML-based configuration with environment variable support for secrets and API keys
- **Database Storage**: Local SQLite database tracks audiobooks, notification status, and cleans up released books automatically
- **Batch & Manual Modes**: Run as a scheduled job or interactively via the web UI
- **Dark Mode & Accessibility**: Fully accessible, dark mode ready, and keyboard navigable

---

## 🖥️ Web UI

- **Upcoming Releases**: See all tracked upcoming audiobooks, grouped by month, with cover art, series, narrator, publisher, and Audible links
- **iCal Export**: Download a calendar event for any release (00:00 America/Los_Angeles)
- **Search & Filter**: Instantly search by title, author, series, or narrator; filter by author or date
- **Statistics**: See stats on authors, publishers, and recent additions
- **Configuration Page**: Manage your tracked authors, series, and notification settings
- **Mobile Friendly**: Works great on phones, tablets, and desktops

---

## ⚙️ Installation

1. **Clone this repository**

2. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Configure your settings**:
   - Edit `src/audiostracker/config/config.yaml` for global settings
   - Edit `src/audiostracker/config/audiobooks.json` to specify authors/series to track
   - Create a `.env` file in `src/audiostracker/config` with your API keys and credentials

4. **Run the web UI**:

   ```bash
   python start_webui.py
   # or
   uvicorn src.audiostracker.web.app:app --reload
   ```

   Then open [http://127.0.0.1:5005/](http://127.0.0.1:5005/) in your browser.

5. **(Optional) Run the tracker as a script**:

   ```bash
   python -m src.audiostracker.main
   ```

---

## 🔔 Notifications & Integrations

- **Pushover**: Real-time push notifications to your phone
- **Discord**: Send new release alerts to your Discord server
- **Email**: Get email notifications for new audiobooks
- **Calendar**: Export .ics files for any release or batch

---

## 🛠️ Configuration

- **Environment Variables**: Store secrets in `.env` (see example in `README.md`)
- **YAML & JSON**: All settings and tracked books are editable as plain text
- **Database**: Uses SQLite for reliability and easy backup

---

## 📦 Project Structure

``` tree
├── src/audiostracker/
│   ├── web/                # Web UI (FastAPI, templates, static files)
│   ├── config/             # YAML/JSON config files
│   ├── notify/             # Notification channels (pushover, discord, email)
│   ├── ical_export.py      # iCal export logic
│   ├── main.py             # CLI/script entrypoint
│   ├── database.py         # Database logic
│   └── ...
├── requirements.txt
├── start_webui.py
└── README.md
```

---

## 📝 Example .env

```env
PUSHOVER_API_TOKEN=your_pushover_api_token
PUSHOVER_USER_KEY=your_pushover_user_key

# Discord
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Email
EMAIL_FROM=audiobook-stalker@domain.com
EMAIL_TO=your_email@example.com
EMAIL_USERNAME=your_email@example.com
EMAIL_PASSWORD=your_email_password
```

---

## 📝 Example config.yaml

```yaml
# global config
cron_settings:
  enabled: true # enable cron job for periodic tasks
  cron: "0 9 * * *"  # run once a day at 09:00
  timezone: "America/Chicago" # timezone for cron job scheduling
max_results: 50 # maximum number of results to return; Audible API allows up to 50
log_level: DEBUG # options: DEBUG, INFO, WARNING, ERROR
log_format: json # options: json, text
language: "english" # default language for Audible searches (english, spanish, french, etc.)

# Web UI Configuration
web_ui:
  port: 5005 # port to run the web server on
  host: "0.0.0.0" # host to bind to (use 0.0.0.0 for all interfaces)
  reload: true # enable auto-reload for development

# Notification channels
pushover:
  enabled: true
  sound: "pushover" # default notification sound
  priority: 0 # -2 (lowest) to 2 (emergency)
  device: "" # optional: target a specific device
  # user_key and api_token will be loaded from .env, not here

discord:
  enabled: false # set to true to enable Discord notifications
  webhook_url: "" # Discord webhook URL (load from .env)
  username: "Audiobook Stalkerr" # bot username
  avatar_url: "" # optional: bot avatar URL
  color: "0x1F8B4C" # embed color (hex)

email:
  enabled: true # set to true to enable email notifications
  smtp_server: "smtp.gmail.com" # SMTP server
  smtp_port: 587 # SMTP port
  use_tls: true # use TLS
  use_ssl: false # use SSL (alternative to TLS)
  from_email: "" # sender email (load from .env)
  to_emails: [] # list of recipient emails (load from .env)
  # username and password will be loaded from .env, not here

rate_limits:
  audible_api_per_minute: 240 # 4 requests per second = 240 per minute (parallel async requests)
  notification_per_minute: 5 # hardcoded in code, shown here for reference
  db_ops_per_second: 20 # hardcoded in code, shown here for reference

ical:
  enabled: true # enable iCal export
  batch:
    enabled: true # enable batching of iCal exports
    max_books: 10 # maximum number of books to include in a single batch
    file_path: "data/ical_export/" # directory to save iCal files

database:
  cleanup_grace_period_days: 0 # 0 = remove books on their release date, >0 = keep for N days after release
  vacuum_interval_days: 7 # run VACUUM command every N days to optimize database size
```

---

## 📝 Example audiobooks.json

```json
{
  "audiobooks": {
    "author": {
      "Akumi Agitogi": [
        {
          "narrator": [
            "Miranda Parkin",
            "Damien Haas"
          ],
          "publisher": "Yen audio",
          "series": "My Happy Marriage",
          "title": "My Happy Marriage"
        }
      ],
      "Aneko Yusagi": [
        {
          "narrator": [
            "Kurt Kanazawa",
            "Matthew Bridges",
            "Shea Taylor"
          ],
          "publisher": "Yen audio",
          "series": "The Rising of the Shield Hero",
          "title": "The Rising of the Shield Hero"
        }
      ],
      // ... more authors ...
    }
  }
}
```

---

## 🏷️ License

MIT
