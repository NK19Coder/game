// run: node init-admin.js
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const readline = require('readline');

const DB_FILE = process.env.DB_FILE || './data.db';
const ENV_USER = process.env.ADMIN_USER;
const ENV_PASS = process.env.ADMIN_PASS;

const db = new sqlite3.Database(DB_FILE);
git add package.json package-lock.json server.js init-admin.js
function ensureTable(cb) {
  db.run(
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT
    )`,
    cb
  );
}

async function upsertAdmin(username, password) {
  const hash = await bcrypt.hash(password, 10);
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO admins (id, username, password_hash)
       VALUES ((SELECT id FROM admins WHERE username = ?), ?, ?)`,
      [username, username, hash],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

async function run() {
  try {
    await new Promise((r, j) => ensureTable(err => (err ? j(err) : r())));

    if (ENV_USER && ENV_PASS) {
      await upsertAdmin(ENV_USER, ENV_PASS);
      console.log(`✅ Admin ready (env). username="${ENV_USER}"`);
      db.close();
      process.exit(0);
      return;
    }

    // Fallback to interactive prompt (good locally)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Admin username: ', username => {
      rl.question('Admin password: ', async password => {
        try {
          await upsertAdmin(username, password);
          console.log('✅ Admin user created/updated successfully!');
        } catch (e) {
          console.error('❌ Error:', e.message);
          process.exitCode = 1;
        } finally {
          rl.close();
          db.close();
        }
      });
    });
  } catch (e) {
    console.error('❌ Init error:', e.message);
    db.close();
    process.exit(1);
  }
}

run();
