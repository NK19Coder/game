const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DB_FILE = './data.db';
const PORT = process.env.PORT || 3000;

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'replace_with_a_strong_secret',
  resave: false,
  saveUninitialized: false
}));

// setup uploads
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// open DB
const db = new sqlite3.Database(DB_FILE);
console.log('📁 Using database at:', path.resolve(DB_FILE));


// create tables if not exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    short_desc TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});
// --- Seed demo games if table empty ---
db.get('SELECT COUNT(*) as cnt FROM games', (err, row) => {
  if (err) {
    console.error('Seed check error:', err);
    return;
  }
  if (row && row.cnt === 0) {
    const seedGames = [
      { title: 'Super Speed Racer', short_desc: 'Fast cars, sharp turns — race to the finish!', image: 'https://picsum.photos/seed/racer/800/500' },
      { title: 'Jungle Jump', short_desc: 'Jump, dodge and collect coins in the wild jungle.', image: 'https://picsum.photos/seed/jungle/800/500' },
      { title: 'Puzzle Master', short_desc: 'Solve clever puzzles to progress through levels.', image: 'https://picsum.photos/seed/puzzle/800/500' },
      { title: 'Soccer Clash', short_desc: 'Quick arcade soccer matches with power-ups.', image: 'https://picsum.photos/seed/soccer/800/500' },
      { title: 'Space Shooter', short_desc: 'Defend your ship from waves of aliens.', image: 'https://picsum.photos/seed/space/800/500' },
      { title: 'Farm Frenzy', short_desc: 'Plant, harvest and expand your cozy farm.', image: 'https://picsum.photos/seed/farm/800/500' },
      { title: 'Glow Runner', short_desc: 'An endless runner with neon visuals.', image: 'https://picsum.photos/seed/runner/800/500' },
      { title: 'Brick Breaker Pro', short_desc: 'Classic brick breaker with modern power-ups.', image: 'https://picsum.photos/seed/brick/800/500' },
      { title: 'Mystery Manor', short_desc: 'Explore the manor and uncover hidden secrets.', image: 'https://picsum.photos/seed/manor/800/500' },
      { title: 'Zen Garden', short_desc: 'Relaxing mini-games to de-stress.', image: 'https://picsum.photos/seed/zen/800/500' }
    ];

    const stmt = db.prepare('INSERT INTO games (title, short_desc, image) VALUES (?, ?, ?)');
    seedGames.forEach(g => {
      stmt.run(g.title, g.short_desc, g.image);
    });
    stmt.finalize(err2 => {
      if (err2) console.error('Seed insert error:', err2);
      else console.log('✅ Seeded demo games into `games` table.');
    });
  } else {
    console.log('Seed: games table already has data (count =', row ? row.cnt : 'unknown', ').');
  }
});


// middleware to require admin auth
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.redirect('/admin/login');
}

// Public: home - list games
app.get('/', (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).send('DB error');
    res.render('index', { games: rows, user: req.session.adminUser || null });
  });
});

// Admin login form
app.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

// Admin login post
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

// Admin logout
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

// Add game (via form) — supports image upload or url
app.post('/admin/games/add', requireAdmin, upload.single('imagefile'), (req, res) => {
  const { title, short_desc, imageurl } = req.body;
  let imagePath = imageurl && imageurl.trim() !== '' ? imageurl.trim() : null;
  if (req.file) {
    imagePath = '/uploads/' + path.basename(req.file.path);
  }
  if (!imagePath) imagePath = '/placeholder.png';
  db.run('INSERT INTO games (title, short_desc, image) VALUES (?, ?, ?)',
    [title, short_desc, imagePath], function(err) {
      if (err) return res.status(500).send('DB error');
      res.redirect('/admin');
    });
});

// Delete game
app.post('/admin/games/delete/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  // if image is local file, attempt delete
  db.get('SELECT image FROM games WHERE id = ?', [id], (err, row) => {
    if (row && row.image && row.image.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, 'public', row.image);
      fs.unlink(filePath, () => {
        // ignore unlink errors
        db.run('DELETE FROM games WHERE id = ?', [id], (err2) => {
          if (err2) return res.status(500).send('DB error');
          res.redirect('/admin');
        });
      });
    } else {
      db.run('DELETE FROM games WHERE id = ?', [id], (err2) => {
        if (err2) return res.status(500).send('DB error');
        res.redirect('/admin');
      });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
