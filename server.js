// server.js (env-enabled)
console.log("✅ Running MERGED server.js");

require('dotenv').config(); // ← loads .env first

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// ----- ENV FALLBACKS -----
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'public', 'uploads');
if (!process.env.SESSION_SECRET) {
  console.error("❌ SESSION_SECRET missing! Add it to .env");
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET; 

// ----- EXPRESS BASE -----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve /public as usual
app.use(express.static(path.join(__dirname, 'public')));

// Also serve uploads even if they’re outside /public
// (This maps the physical UPLOADS_DIR to /uploads in URLs)
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// ----- UPLOADS -----
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ----- DB -----
const db = new sqlite3.Database(DB_FILE);
console.log('📁 Using database at:', path.resolve(DB_FILE));

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

  // Ensure game_link exists (for old DBs)
  db.all(`PRAGMA table_info(games)`, (err, rows) => {
    if (err) return console.error('PRAGMA error:', err);
    const hasGameLink = Array.isArray(rows) && rows.some(c => c.name === 'game_link');
    if (!hasGameLink) {
      db.run(`ALTER TABLE games ADD COLUMN game_link TEXT`, (e2) => {
        if (e2) console.error('ALTER TABLE games add game_link error:', e2);
        else console.log('✅ Added games.game_link column');
      });
    }
  });
});

// Seed demo games once
db.get('SELECT COUNT(*) as cnt FROM games', (err, row) => {
  if (err) { console.error('Seed check error:', err); return; }
  if (row && row.cnt === 0) {
    const seedGames = [
      { title: 'Neon Runner', short_desc: 'A fast-paced endless runner with neon visuals and powerups.', image: '/placeholder.png' },
      { title: 'Speed Rally', short_desc: 'Arcade-style top-down racing with tight turns and boosts.', image: '/placeholder.png' },
      { title: 'Mystic Blocks', short_desc: 'Match & clear colorful blocks to solve relaxing puzzles.', image: '/placeholder.png' },
      { title: 'Alien Shooter', short_desc: 'Defend your ship against waves of alien invaders.', image: '/placeholder.png' },
      { title: 'Castle Escape', short_desc: 'Platformer adventure — jump, climb and escape the castle.', image: '/placeholder.png' },
      { title: 'Soccer Heroes', short_desc: 'Quick arcade soccer matches with simple controls.', image: '/placeholder.png' },
      { title: 'Farm Bloom', short_desc: 'Manage your crops and expand the cozy farm.', image: '/placeholder.png' },
      { title: 'Brick Smash', short_desc: 'Modern brick breaker with physics and powerups.', image: '/placeholder.png' },
      { title: 'Zen Garden', short_desc: 'Relaxing mini-games to unwind and enjoy.', image: '/placeholder.png' },
      { title: 'Sky Jump', short_desc: 'Precision platformer with short levels and big rewards.', image: '/placeholder.png' }
    ];
    const stmt = db.prepare('INSERT INTO games (title, short_desc, image) VALUES (?, ?, ?)');
    seedGames.forEach(g => stmt.run(g.title, g.short_desc, g.image));
    stmt.finalize(err2 => {
      if (err2) console.error('Seed insert error:', err2);
      else console.log('✅ Seeded demo games.');
    });
  } else {
    console.log('Seed: games table already has data. Count =', row ? row.cnt : 'unknown');
  }
});

// ----- HELPERS -----
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

// ----- ROUTES -----
// Public home
app.get('/', (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('index', { games: rows, user: req.session.adminUser || null });
  });
});

// Public: Play redirect
app.get('/play/:id', (req, res) => {
  db.get('SELECT game_link FROM games WHERE id = ?', [req.params.id], (err, row) => {
    if (err || !row || !row.game_link) return res.status(404).send('Game link not found');
    res.redirect(row.game_link);
  });
});

// Optional debug
app.get('/debug/:id', (req, res) => {
  db.get('SELECT id, title, game_link FROM games WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).send('DB error: ' + err.message);
    res.json(row || { error: 'not found' });
  });
});

// Admin login pages
app.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

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

// Admin dashboard
app.get('/admin', requireAdmin, (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('admin_dashboard', { games: rows, user: req.session.adminUser });
  });
});

// Add game
app.post('/admin/games/add', requireAdmin, upload.single('imagefile'), (req, res) => {
  const { title, short_desc, imageurl, gamelink } = req.body;
  let imagePath = imageurl && imageurl.trim() ? imageurl.trim() : null;
  if (req.file) imagePath = '/uploads/' + path.basename(req.file.path);
  if (!imagePath) imagePath = '/placeholder.png';

  const game_link = normalizeUrl(gamelink);
  db.run(
    'INSERT INTO games (title, short_desc, image, game_link) VALUES (?, ?, ?, ?)',
    [title, short_desc, imagePath, game_link],
    err => err ? res.status(500).send('DB error') : res.redirect('/admin')
  );
});

// Edit game
app.post('/admin/games/edit/:id', requireAdmin, upload.single('imagefile'), (req, res) => {
  const id = req.params.id;
  const { title, short_desc, imageurl, gamelink } = req.body;

  db.get('SELECT image FROM games WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row) return res.status(404).send('Game not found');

    let newImage = row.image;
    if (req.file) {
      if (row.image && row.image.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOADS_DIR, path.basename(row.image));
        fs.unlink(oldPath, () => {});
      }
      newImage = '/uploads/' + path.basename(req.file.path);
    } else if (imageurl && imageurl.trim() !== '') {
      if (row.image && row.image.startsWith('/uploads/')) {
        const oldPath = path.join(UPLOADS_DIR, path.basename(row.image));
        fs.unlink(oldPath, () => {});
      }
      newImage = imageurl.trim();
    }

    const gameLink = normalizeUrl(gamelink);
    db.run(
      'UPDATE games SET title = ?, short_desc = ?, image = ?, game_link = ? WHERE id = ?',
      [title, short_desc, newImage, gameLink, id],
      (updateErr) => updateErr ? res.status(500).send('DB error') : res.redirect('/admin')
    );
  });
});

// Delete game
app.post('/admin/games/delete/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.get('SELECT image FROM games WHERE id = ?', [id], (err, row) => {
    const afterDelete = () => {
      db.run('DELETE FROM games WHERE id = ?', [id], (err2) => {
        if (err2) return res.status(500).send('DB error');
        res.redirect('/admin');
      });
    };
    if (row && row.image && row.image.startsWith('/uploads/')) {
      const filePath = path.join(UPLOADS_DIR, path.basename(row.image));
      fs.unlink(filePath, () => afterDelete());
    } else {
      afterDelete();
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
