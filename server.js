
// console.log("✅ Running MERGED server.js");
// require('dotenv').config();

// const express = require('express');
// const bodyParser = require('body-parser');
// const session = require('express-session');
// const bcrypt = require('bcryptjs');
// const path = require('path');
// const fs = require('fs');
// const Database = require('better-sqlite3');
// const cloudinary = require('cloudinary').v2;
// const multer = require('multer');
// const AdmZip = require('adm-zip');
// const slugify = require('slugify');

// const app = express();

// /* =========================
//    ENV & PATHS
//    ========================= */
// const PORT = process.env.PORT || 3000;
// const RAW_DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');

// if (!process.env.SESSION_SECRET) {
//   console.error("❌ SESSION_SECRET missing! Add it to environment variables.");
//   process.exit(1);
// }
// const SESSION_SECRET = process.env.SESSION_SECRET;

// // Optional Cloudinary (only used if creds exist)
// const hasCloudinary =
//   !!process.env.CLOUDINARY_CLOUD_NAME &&
//   !!process.env.CLOUDINARY_API_KEY &&
//   !!process.env.CLOUDINARY_API_SECRET;

// if (hasCloudinary) {
//   cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
//     secure: true
//   });
// }

// // Local folders (for images/games when not using external storage)
// const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');
// const GAMES_DIR   = process.env.GAMES_DIR   || path.join(__dirname, 'public', 'games');

// // Ensure folders exist
// [UPLOADS_DIR, GAMES_DIR, path.join(__dirname, 'public')].forEach(dir => {
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
// });

// // Serve static
// app.use('/uploads', express.static(UPLOADS_DIR));
// app.use('/games',   express.static(GAMES_DIR));
// app.use(express.static(path.join(__dirname, 'public')));

// /* =========================
//    EXPRESS BASE
//    ========================= */
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(session({
//   secret: SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false
// }));

// /* =========================
//    Multer (in-memory)
//    - fields: imagefile (image), gamefile (zip)
//    ========================= */
// const upload = multer({ storage: multer.memoryStorage() });

// /* =========================
//    DB PATH RESOLVER
//    ========================= */
// function resolveDbPath(p) {
//   const abs = path.isAbsolute(p) ? p : path.join(__dirname, p);
//   const dir = path.dirname(abs);
//   try {
//     fs.mkdirSync(dir, { recursive: true });
//     fs.accessSync(dir, fs.constants.W_OK);
//     return abs;
//   } catch (e) {
//     const fallback = path.join(__dirname, 'data.db'); // local fallback
//     console.warn(`⚠️ Cannot use DB_FILE="${abs}" (${e.message}). Falling back to ${fallback}`);
//     return fallback;
//   }
// }
// const DB_PATH = resolveDbPath(RAW_DB_FILE);

// /* =========================
//    DB (better-sqlite3 + tiny shim)
//    ========================= */
// const _db = new Database(DB_PATH);
// console.log('📁 Using database at:', DB_PATH);

// const db = {
//   serialize(fn) { try { fn(); } catch (e) { console.error(e); } },
//   run(sql, params, cb) {
//     try {
//       if (typeof params === 'function') { cb = params; params = []; }
//       const info = _db.prepare(sql).run(params || []);
//       cb && cb(null);
//       return info;
//     } catch (err) { cb && cb(err); }
//   },
//   get(sql, params, cb) {
//     try {
//       if (typeof params === 'function') { cb = params; params = []; }
//       const row = _db.prepare(sql).get(params || []);
//       cb && cb(null, row);
//       return row;
//     } catch (err) { cb && cb(err); }
//   },
//   all(sql, params, cb) {
//     try {
//       if (typeof params === 'function') { cb = params; params = []; }
//       const rows = _db.prepare(sql).all(params || []);
//       cb && cb(null, rows);
//       return rows;
//     } catch (err) { cb && cb(err); }
//   },
//   prepare(sql) { return _db.prepare(sql); }
// };

// /* =========================
//    SCHEMA / MIGRATIONS
//    ========================= */
// db.serialize(() => {
//   db.run(`CREATE TABLE IF NOT EXISTS admins (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     username TEXT UNIQUE,
//     password_hash TEXT
//   )`);

//   db.run(`CREATE TABLE IF NOT EXISTS games (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     title TEXT NOT NULL,
//     short_desc TEXT,
//     image TEXT,
//     game_link TEXT,
//     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//   )`);

//   // Ensure game_link exists (for old DBs)
//   db.all(`PRAGMA table_info(games)`, (err, rows) => {
//     if (err) return console.error('PRAGMA error:', err);
//     const hasGameLink = Array.isArray(rows) && rows.some(c => c.name === 'game_link');
//     if (!hasGameLink) {
//       db.run(`ALTER TABLE games ADD COLUMN game_link TEXT`, (e2) => {
//         if (e2) console.error('ALTER TABLE games add game_link error:', e2);
//         else console.log('✅ Added games.game_link column');
//       });
//     }
//   });
// });

// // Seed demo (no links)
// db.get('SELECT COUNT(*) as cnt FROM games', (err, row) => {
//   if (err) { console.error('Seed check error:', err); return; }
//   if (row && row.cnt === 0) {
//     const seedGames = [
//       { title: 'Neon Runner', short_desc: 'A fast-paced endless runner with neon visuals and powerups.', image: '/placeholder.png' },
//       { title: 'Speed Rally', short_desc: 'Arcade racing with tight turns and boosts.', image: '/placeholder.png' },
//       { title: 'Mystic Blocks', short_desc: 'Match & clear colorful blocks to relax.', image: '/placeholder.png' },
//     ];
//     const stmt = db.prepare('INSERT INTO games (title, short_desc, image) VALUES (?, ?, ?)');
//     seedGames.forEach(g => stmt.run(g.title, g.short_desc, g.image));
//     try { stmt.finalize && stmt.finalize(); } catch {}
//     console.log('✅ Seeded demo games.');
//   }
// });

// /* =========================
//    HELPERS
//    ========================= */
// function requireAdmin(req, res, next) {
//   if (req.session && req.session.adminId) return next();
//   res.redirect('/admin/login');
// }
// function normalizeUrl(u) {
//   if (!u) return '';
//   u = String(u).trim();
//   if (!u) return '';
//   if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
//   return u;
// }
// function uploadImageBuffer(buffer, originalName) {
//   // Prefer Cloudinary if configured
//   if (hasCloudinary) {
//     return new Promise((resolve, reject) => {
//       const stream = cloudinary.uploader.upload_stream(
//         {
//           folder: 'gamezone',
//           filename_override: originalName || `image-${Date.now()}`,
//           resource_type: 'image',
//           use_filename: true,
//           unique_filename: true,
//           overwrite: false
//         },
//         (err, result) => err ? reject(err) : resolve(result.secure_url)
//       );
//       stream.end(buffer);
//     });
//   }
//   // Fallback: local save
//   const base = `${Date.now()}-${(originalName || 'image').replace(/\s+/g, '_')}`;
//   const fname = path.join(UPLOADS_DIR, base);
//   fs.writeFileSync(fname, buffer);
//   return Promise.resolve(`/uploads/${path.basename(fname)}`);
// } 

// function extractZipToGames(buffer, folderName) {
//   const safeFolder = slugify(folderName || `game-${Date.now()}`, { lower: true, strict: true });
//   const destRoot   = path.join(GAMES_DIR, `${safeFolder}-${Date.now()}`);
//   fs.mkdirSync(destRoot, { recursive: true });

//   const zip = new AdmZip(buffer);
//   zip.extractAllTo(destRoot, true);

//   // Try to locate an index.html inside extracted content
//   const indexRel = findIndexHtmlRelative(destRoot);
//   if (!indexRel) {
//     return { link: null, folder: destRoot };
//   }
//   // We serve /games relative to GAMES_DIR
//   const relFromGames = path.relative(GAMES_DIR, path.join(destRoot, indexRel)).split(path.sep).join('/');
//   return { link: `/games/${relFromGames}`, folder: destRoot };
// }

// function findIndexHtmlRelative(rootDir) {
//   const stack = [rootDir];
//   while (stack.length) {
//     const dir = stack.pop();
//     const entries = fs.readdirSync(dir, { withFileTypes: true });
//     for (const e of entries) {
//       const p = path.join(dir, e.name);
//       if (e.isFile() && /^index\.html?$/i.test(e.name)) {
//         return path.relative(rootDir, p);
//       }
//       if (e.isDirectory()) stack.push(p);
//     }
//   }
//   return null;
// }

// /* =========================
//    ROUTES
//    ========================= */

// // Public home
// app.get('/', (req, res) => {
//   db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
//     if (err) return res.status(500).send('DB error');
//     res.render('index', { games: rows, user: req.session.adminUser || null });
//   });
// });

// // Redirect to game link (external or local /games/…/index.html)
// app.get('/play/:id', (req, res) => {
//   db.get('SELECT game_link FROM games WHERE id = ?', [req.params.id], (err, row) => {
//     if (err || !row || !row.game_link) return res.status(404).send('Game link not found');
//     res.redirect(row.game_link);
//   });
// });

// // Debug helper
// app.get('/debug/:id', (req, res) => {
//   db.get('SELECT id, title, game_link FROM games WHERE id = ?', [req.params.id], (err, row) => {
//     if (err) return res.status(500).send('DB error: ' + err.message);
//     res.json(row || { error: 'not found' });
//   });
// });

// // Admin login
// app.get('/admin/login', (req, res) => {
//   res.render('admin_login', { error: null });
// });
// app.post('/admin/login', (req, res) => {
//   const { username, password } = req.body;
//   db.get('SELECT * FROM admins WHERE username = ?', [username], async (err, admin) => {
//     if (err) return res.status(500).send('DB error');
//     if (!admin) return res.render('admin_login', { error: 'Invalid credentials' });
//     const ok = await bcrypt.compare(password, admin.password_hash);
//     if (!ok) return res.render('admin_login', { error: 'Invalid credentials' });
//     req.session.adminId = admin.id;
//     req.session.adminUser = admin.username;
//     res.redirect('/admin');
//   });
// });
// app.get('/admin/logout', (req, res) => {
//   req.session.destroy(() => res.redirect('/'));
// });

// // Admin dashboard
// app.get('/admin', requireAdmin, (req, res) => {
//   db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
//     if (err) return res.status(500).send('DB error');
//     res.render('admin_dashboard', { games: rows, user: req.session.adminUser });
//   });
// });

// /*  Add Game
//     - imagefile: optional image (Cloudinary or local)
//     - imageurl:  optional image URL
//     - gamelink:  optional external URL
//     - gamefile:  optional ZIP of HTML game (served under /games)
// */
// app.post('/admin/games/add',
//   requireAdmin,
//   upload.fields([{ name: 'imagefile', maxCount: 1 }, { name: 'gamefile', maxCount: 1 }]),
//   async (req, res) => {
//     try {
//       const { title, short_desc, imageurl, gamelink } = req.body;

//       // image
//       let imagePath = imageurl && imageurl.trim() ? imageurl.trim() : null;
//       if (!imagePath && req.files && req.files.imagefile && req.files.imagefile[0]) {
//         imagePath = await uploadImageBuffer(req.files.imagefile[0].buffer, req.files.imagefile[0].originalname);
//       }
//       if (!imagePath) imagePath = '/placeholder.png';

//       // game link: prefer ZIP upload -> local hosted, else external link
//       let finalLink = '';
//       if (req.files && req.files.gamefile && req.files.gamefile[0]) {
//         const { link } = extractZipToGames(req.files.gamefile[0].buffer, title);
//         if (link) finalLink = link;
//       }
//       if (!finalLink && gamelink && gamelink.trim()) {
//         finalLink = normalizeUrl(gamelink);
//       }

//       db.run(
//         'INSERT INTO games (title, short_desc, image, game_link) VALUES (?, ?, ?, ?)',
//         [title, short_desc, imagePath, finalLink],
//         err => err ? res.status(500).send('DB error') : res.redirect('/admin')
//       );
//     } catch (e) {
//       console.error('Add game error:', e);
//       res.status(500).send('Add game error');
//     }
//   }
// );

// // Edit Game (same rules as add; new ZIP replaces link; new image replaces image)
// app.post('/admin/games/edit/:id',
//   requireAdmin,
//   upload.fields([{ name: 'imagefile', maxCount: 1 }, { name: 'gamefile', maxCount: 1 }]),
//   async (req, res) => {
//     const id = req.params.id;
//     const { title, short_desc, imageurl, gamelink } = req.body;

//     db.get('SELECT * FROM games WHERE id = ?', [id], async (err, row) => {
//       if (err) return res.status(500).send('DB error');
//       if (!row) return res.status(404).send('Game not found');

//       try {
//         // image
//         let newImage = row.image || '/placeholder.png';
//         if (req.files && req.files.imagefile && req.files.imagefile[0]) {
//           newImage = await uploadImageBuffer(req.files.imagefile[0].buffer, req.files.imagefile[0].originalname);
//         } else if (imageurl && imageurl.trim() !== '') {
//           newImage = imageurl.trim();
//         }

//         // link
//         let newLink = row.game_link || '';
//         if (req.files && req.files.gamefile && req.files.gamefile[0]) {
//           const { link } = extractZipToGames(req.files.gamefile[0].buffer, title || row.title);
//           if (link) newLink = link;
//         } else if (gamelink && gamelink.trim() !== '') {
//           newLink = normalizeUrl(gamelink);
//         }

//         db.run(
//           'UPDATE games SET title = ?, short_desc = ?, image = ?, game_link = ? WHERE id = ?',
//           [title, short_desc, newImage, newLink, id],
//           (updateErr) => updateErr ? res.status(500).send('DB error') : res.redirect('/admin')
//         );
//       } catch (e) {
//         console.error('Edit game error:', e);
//         res.status(500).send('Edit game error');
//       }
//     });
//   }
// );

// // Delete Game (does not delete extracted game folder to keep it simple)
// app.post('/admin/games/delete/:id', requireAdmin, (req, res) => {
//   db.run('DELETE FROM games WHERE id = ?', [req.params.id], (err2) => {
//     if (err2) return res.status(500).send('DB error');
//     res.redirect('/admin');
//   });
// });

// /* =========================
//    START
//    ========================= */
// app.listen(PORT, () => {
//   console.log(`✅ Server started on http://localhost:${PORT}`);
// });



// server.js (persistent-disk version — no Cloudinary)
// Requirements: npm i express body-parser express-session better-sqlite3 bcryptjs multer adm-zip slugify dotenv ejs
console.log("✅ Starting server (persistent-disk mode)");

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const slugify = require('slugify');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();

// ---------- ENV & PATHS ----------
const PORT = process.env.PORT || 3000;
if (!process.env.SESSION_SECRET) {
  console.error('❌ SESSION_SECRET is required. Set it in env/.env');
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET;

// Desired default locations (Render persistent disk example)
const RAW_DB_FILE = process.env.DB_FILE || path.join('/var', 'data', 'data.db'); // recommended /var/data/data.db on Render if disk mounted
const RAW_UPLOADS_DIR = process.env.UPLOADS_DIR || path.join('/var', 'data', 'uploads');
const RAW_GAMES_DIR = process.env.GAMES_DIR || path.join('/var', 'data', 'games');

// Helper: ensure dir exists and writable; fallback to local ./data if not possible
function ensureDirOrFallback(dir, fallbackSub) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch (e) {
    const fallback = path.join(__dirname, fallbackSub);
    try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
    console.warn(`⚠️ Cannot use "${dir}" (${e.message}). Falling back to "${fallback}"`);
    return fallback;
  }
}

const UPLOADS_DIR = ensureDirOrFallback(RAW_UPLOADS_DIR, 'data/uploads');
const GAMES_DIR = ensureDirOrFallback(RAW_GAMES_DIR, 'data/games');

// Ensure parent of DB exists or fallback
function resolveDbPath(rawPath) {
  const abs = path.isAbsolute(rawPath) ? rawPath : path.join(__dirname, rawPath);
  const dir = path.dirname(abs);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return abs;
  } catch (e) {
    const fallback = path.join(__dirname, 'data', 'data.db');
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    console.warn(`⚠️ Cannot use DB path "${abs}" (${e.message}). Falling back to "${fallback}"`);
    return fallback;
  }
}
const DB_FILE = resolveDbPath(RAW_DB_FILE);

// ---------- EXPRESS / TEMPLATE / STATIC ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve public assets, uploads and extracted games
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/games', express.static(GAMES_DIR));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// ---------- MULTER (disk storage) ----------
// We store uploaded images directly to UPLOADS_DIR, and ZIP uploads also to a temp location then extract.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // decide folder based on fieldname
    if (file.fieldname === 'gamefile') {
      // temporary store zips under UPLOADS_DIR/tmp
      const tmp = path.join(UPLOADS_DIR, 'tmp');
      fs.mkdirSync(tmp, { recursive: true });
      cb(null, tmp);
    } else {
      cb(null, UPLOADS_DIR);
    }
  },
  filename: function (req, file, cb) {
    const safe = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safe);
  }
});
const upload = multer({ storage });

// ---------- DATABASE (better-sqlite3) ----------
const _db = new Database(DB_FILE);
console.log('📁 Using database at:', DB_FILE);

const db = {
  serialize(fn) { try { fn(); } catch (e) { console.error(e); } },
  run(sql, params, cb) {
    try {
      if (typeof params === 'function') { cb = params; params = []; }
      const info = _db.prepare(sql).run(params || []);
      cb && cb(null);
      return info;
    } catch (err) { cb && cb(err); }
  },
  get(sql, params, cb) {
    try {
      if (typeof params === 'function') { cb = params; params = []; }
      const row = _db.prepare(sql).get(params || []);
      cb && cb(null, row);
      return row;
    } catch (err) { cb && cb(err); }
  },
  all(sql, params, cb) {
    try {
      if (typeof params === 'function') { cb = params; params = []; }
      const rows = _db.prepare(sql).all(params || []);
      cb && cb(null, rows);
      return rows;
    } catch (err) { cb && cb(err); }
  },
  prepare(sql) { return _db.prepare(sql); }
};

// ---------- SCHEMA / MIGRATION ----------
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    short_desc TEXT,
    image TEXT,
    game_link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // add game_link if older schema didn't have it
  db.all(`PRAGMA table_info(games)`, (err, rows) => {
    if (err) return console.error('PRAGMA error:', err);
    if (Array.isArray(rows) && !rows.some(c => c.name === 'game_link')) {
      db.run(`ALTER TABLE games ADD COLUMN game_link TEXT`, (e2) => {
        if (e2) console.error('ALTER TABLE error:', e2);
        else console.log('✅ Added games.game_link column');
      });
    }
  });
});

// Seed demo entry if empty
db.get('SELECT COUNT(*) as cnt FROM games', (err, row) => {
  if (err) { console.error('Seed check error:', err); return; }
  if (row && row.cnt === 0) {
    const stmt = db.prepare('INSERT INTO games (title, short_desc, image) VALUES (?, ?, ?)');
    stmt.run('Neon Runner', 'A demo neon runner', '/placeholder.png');
    stmt.run('Speed Rally', 'Demo racing', '/placeholder.png');
    console.log('✅ Seeded demo games.');
  }
});

// ---------- HELPERS ----------
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.redirect('/admin/login');
}
function normalizeUrl(u) {
  if (!u) return '';
  u = String(u).trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function extractZipToGames(zipPath, titleHint) {
  // unzip zipPath (on disk) into a unique folder under GAMES_DIR and try to return the index.html URL path
  const safeName = slugify(titleHint || path.basename(zipPath, path.extname(zipPath)), { lower: true, strict: true });
  const destFolder = path.join(GAMES_DIR, `${safeName}-${Date.now()}`);
  fs.mkdirSync(destFolder, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destFolder, true);

  // find first index.html inside extracted folder
  const stack = [destFolder];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isFile() && /^index\.html?$/i.test(e.name)) {
        const rel = path.relative(GAMES_DIR, p).split(path.sep).join('/');
        return `/games/${rel}`; // URL path to index
      }
      if (e.isDirectory()) stack.push(p);
    }
  }
  // no index found — return folder root (may still work if user has a different entry)
  const relRoot = path.relative(GAMES_DIR, destFolder).split(path.sep).join('/');
  return `/games/${relRoot}/`;
}

// ---------- ROUTES ----------

// homepage
app.get('/', (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('index', { games: rows, user: req.session.adminUser || null });
  });
});

// play route — redirects to either external link or local /games/ path
app.get('/play/:id', (req, res) => {
  db.get('SELECT game_link FROM games WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row || !row.game_link) return res.status(404).send('Game link not found');
    res.redirect(row.game_link);
  });
});

// debug
app.get('/debug/:id', (req, res) => {
  db.get('SELECT id, title, game_link FROM games WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).send('DB error: ' + err.message);
    res.json(row || { error: 'not found' });
  });
});

// admin login
app.get('/admin/login', (req, res) => res.render('admin_login', { error: null }));
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM admins WHERE username = ?', [username], async (err, admin) => {
    if (err) return res.status(500).send('DB error');
    if (!admin) return res.render('admin_login', { error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.render('admin_login', { error: 'Invalid credentials' });
    req.session.adminId = admin.id;
    req.session.adminUser = admin.username;
    res.redirect('/admin');
  });
});
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// admin dashboard
app.get('/admin', requireAdmin, (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('admin_dashboard', { games: rows, user: req.session.adminUser });
  });
});

/*
 Add Game route:
 - fields:
    * imagefile (optional) -> stored in UPLOADS_DIR and served at /uploads/...
    * imageurl (optional) -> external image URL
    * gamelink (optional) -> external URL
    * gamefile (optional) -> zip (HTML game). If provided, it's extracted to GAMES_DIR and game_link is set to /games/..../index.html
*/
app.post('/admin/games/add', requireAdmin, upload.fields([
  { name: 'imagefile', maxCount: 1 },
  { name: 'gamefile', maxCount: 1 }
]), (req, res) => {
  try {
    const { title, short_desc, imageurl, gamelink } = req.body;

    // image: prefer imageurl, else uploaded file, else placeholder
    let imagePath = imageurl && imageurl.trim() ? imageurl.trim() : null;
    if (!imagePath && req.files && req.files.imagefile && req.files.imagefile[0]) {
      const f = req.files.imagefile[0];
      imagePath = `/uploads/${path.basename(f.path)}`; // disk storage path
    }
    if (!imagePath) imagePath = '/placeholder.png';

    // game link: prefer uploaded ZIP -> local extracted path; else external gamelink
    let finalLink = '';
    if (req.files && req.files.gamefile && req.files.gamefile[0]) {
      const zipFile = req.files.gamefile[0];
      const link = extractZipToGames(zipFile.path, title || zipFile.originalname);
      finalLink = link;
    } else if (gamelink && gamelink.trim()) {
      finalLink = normalizeUrl(gamelink);
    }

    db.run('INSERT INTO games (title, short_desc, image, game_link) VALUES (?, ?, ?, ?)',
      [title, short_desc, imagePath, finalLink],
      (err) => err ? res.status(500).send('DB error') : res.redirect('/admin'));
  } catch (e) {
    console.error('Add game error:', e);
    res.status(500).send('Add game error');
  }
});

// Edit game (similar to add)
app.post('/admin/games/edit/:id', requireAdmin, upload.fields([
  { name: 'imagefile', maxCount: 1 },
  { name: 'gamefile', maxCount: 1 }
]), (req, res) => {
  const id = req.params.id;
  const { title, short_desc, imageurl, gamelink } = req.body;

  db.get('SELECT * FROM games WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row) return res.status(404).send('Game not found');

    try {
      // image update
      let newImage = row.image || '/placeholder.png';
      if (req.files && req.files.imagefile && req.files.imagefile[0]) {
        const f = req.files.imagefile[0];
        newImage = `/uploads/${path.basename(f.path)}`;
      } else if (imageurl && imageurl.trim() !== '') {
        newImage = imageurl.trim();
      }

      // link update
      let newLink = row.game_link || '';
      if (req.files && req.files.gamefile && req.files.gamefile[0]) {
        const zipFile = req.files.gamefile[0];
        const link = extractZipToGames(zipFile.path, title || row.title);
        newLink = link || newLink;
      } else if (gamelink && gamelink.trim() !== '') {
        newLink = normalizeUrl(gamelink);
      }

      db.run('UPDATE games SET title = ?, short_desc = ?, image = ?, game_link = ? WHERE id = ?',
        [title, short_desc, newImage, newLink, id],
        (updateErr) => updateErr ? res.status(500).send('DB error') : res.redirect('/admin'));
    } catch (e) {
      console.error('Edit game error:', e);
      res.status(500).send('Edit game error');
    }
  });
});

// Delete game
app.post('/admin/games/delete/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM games WHERE id = ?', [req.params.id], (err2) => {
    if (err2) return res.status(500).send('DB error');
    res.redirect('/admin');
  });
});

// start
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT} (port ${PORT})`);
  console.log('Uploads dir:', UPLOADS_DIR);
  console.log('Games dir:  ', GAMES_DIR);
  console.log('DB file:    ', DB_FILE);
});
