// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./data.db');

// Create table if not exists (base columns)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      short_desc TEXT,
      image TEXT
    )
  `, (err) => {
    if (err) console.error('Create table error:', err);
  });

  // Ensure games.game_link exists
  db.all(`PRAGMA table_info(games)`, (err, rows) => {
    if (err) return console.error('PRAGMA error:', err);
    const hasGameLink = rows.some(col => col.name === 'game_link');
    if (!hasGameLink) {
      db.run(`ALTER TABLE games ADD COLUMN game_link TEXT`, (alterErr) => {
        if (alterErr) {
          console.error('ALTER TABLE (add game_link) error:', alterErr);
        } else {
          console.log('✅ Added games.game_link column');
        }
      });
    }
  });
});

module.exports = db;
