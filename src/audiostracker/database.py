import sqlite3
from contextlib import closing

DB_FILE = 'audiobooks.db'

def get_connection():
    return sqlite3.connect(DB_FILE)

def init_db():
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS audiobooks (
                asin TEXT PRIMARY KEY,
                title TEXT,
                author TEXT,
                narrator TEXT,
                publisher TEXT,
                series TEXT,    
                release_date TEXT,
                last_checked TIMESTAMP,
                notified INTEGER DEFAULT 0
            )
        ''')
        conn.commit()

def insert_or_update_audiobook(asin, title, author, narrator, publisher, series, release_date, notified=0):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('''
            INSERT INTO audiobooks (asin, title, author, narrator, publisher, series, release_date, last_checked, notified)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            ON CONFLICT(asin) DO UPDATE SET
                title=excluded.title,
                author=excluded.author,
                narrator=excluded.narrator,
                publisher=excluded.publisher,
                series=excluded.series,
                release_date=excluded.release_date,
                last_checked=datetime('now'),
                notified=excluded.notified
        ''', (asin, title, author, narrator, publisher, series, release_date, notified))
        conn.commit()

def was_notified(asin):
    with get_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT notified FROM audiobooks WHERE asin=?', (asin,))
        row = c.fetchone()
        return bool(row and row[0])

# Example usage (in main.py or a test script):
if __name__ == "__main__":
    init_db()
    insert_or_update_audiobook(
        asin="B0123456",
        title="Cool Book",
        author="Joe Author",
        narrator="Cliff Kirk",
        publisher="MyPub",
        series="MySeries",
        release_date="2025-01-01",
        notified=1
    )
    print(was_notified("B0123456"))
