
// require('dotenv').config();
// const Database = require('better-sqlite3');
// const bcrypt = require('bcryptjs');
// const readline = require('readline');
// const path = require('path');

// const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');
// const ENV_USER = process.env.ADMIN_USER;
// const ENV_PASS = process.env.ADMIN_PASS;

// const db = new Database(DB_FILE);

// function ensureTable() {
//   db.prepare(`
//     CREATE TABLE IF NOT EXISTS admins (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       username TEXT UNIQUE,
//       password_hash TEXT
//     )
//   `).run();
// }

// async function upsertAdmin(username, password) {
//   const hash = await bcrypt.hash(password, 10);
//   const row = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
//   if (row && row.id) {
//     db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, row.id);
//   } else {
//     db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
//   }
// }

// (async () => {
//   try {
//     ensureTable();

//     if (ENV_USER && ENV_PASS) {
//       await upsertAdmin(ENV_USER, ENV_PASS);
//       console.log(`✅ Admin ready (env). username="${ENV_USER}"`);
//       process.exit(0);
//       return; 
//     }

//     // Interactive (local)
//     const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
//     rl.question('Admin username: ', (username) => {
//       rl.question('Admin password: ', async (password) => {
//         try {
//           await upsertAdmin(username, password);
//           console.log('✅ Admin user created/updated successfully!');
//         } catch (e) {
//           console.error('❌ Error:', e.message);
//           process.exitCode = 1;
//         } finally {
//           rl.close();
//         }
//       });
//     });
//   } catch (e) {
//     console.error('❌ Init error:', e.message);
//     process.exit(1);
//   }
// })();


// init-admin.js
require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const RAW_DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

function resolveDbPath(p) {
  const abs = path.isAbsolute(p) ? p : path.join(__dirname, p);
  const dir = path.dirname(abs);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return abs;
  } catch (e) {
    console.warn(`⚠️ Cannot use DB_FILE="${abs}" (${e.message}). Falling back to local "./data.db"`);
    return path.join(__dirname, 'data.db');
  }
}

const DB_FILE = resolveDbPath(RAW_DB_FILE);

// open (creates file if missing)
let db;
try {
  db = new Database(DB_FILE);
  console.log('📁 Using database at:', DB_FILE);
} catch (e) {
  console.error('❌ Failed to open DB:', e.message);
  process.exit(1);
}

function ensureTables() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT
    )
  `).run();
}

async function upsertAdmin(username, password) {
  if (!username || !password) throw new Error('username and password required');
  const hash = await bcrypt.hash(password, 10);
  const row = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
  if (row && row.id) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, row.id);
    return { updated: true };
  } else {
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
    return { created: true };
  }
}

(async function main() {
  try {
    ensureTables();

    if (ADMIN_USER && ADMIN_PASS) {
      await upsertAdmin(ADMIN_USER, ADMIN_PASS);
      console.log(`✅ Admin ready (env). username="${ADMIN_USER}"`);
      process.exit(0);
      return;
    }

    // interactive fallback for local testing
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.question('Admin username: ', username => {
      rl.question('Admin password: ', async password => {
        try {
          await upsertAdmin(username.trim(), password);
          console.log('✅ Admin user created/updated successfully!');
          rl.close();
          process.exit(0);
        } catch (err) {
          console.error('❌ Error creating admin:', err.message);
          rl.close();
          process.exit(1);
        }
      });
    });

  } catch (err) {
    console.error('❌ Init error:', err.message);
    process.exit(1);
  }
})();

