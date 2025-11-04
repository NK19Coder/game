// app.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const db = require('./database');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ---------- ROUTES ----------

// Homepage
app.get('/', (req, res) => {
  db.all('SELECT * FROM games', (err, games) => {
    if (err) return res.send('Error loading games');
    res.render('index', { games });
  });
});

// Admin login page
app.get('/admin/login', (req, res) => {
  res.render('admin_login');
});

// Admin login POST
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '12345') {
    res.redirect('/admin/dashboard');
  } else {
    res.send('<h2>❌ Invalid credentials. Try again!</h2><a href="/admin/login">Go Back</a>');
  }
});

// Admin dashboard
app.get('/admin/dashboard', (req, res) => {
  db.all('SELECT * FROM games', (err, games) => {
    if (err) return res.send('Error fetching games');
    res.render('admin_dashboard', { games });
  });
});

// Add new game
app.post('/admin/games/add', upload.single('imagefile'), (req, res) => {
  const { title, short_desc, imageurl } = req.body;
  const image = imageurl || (req.file ? '/uploads/' + req.file.filename : null);

  db.run('INSERT INTO games (title, short_desc, image) VALUES (?, ?, ?)', [title, short_desc, image], err => {
    if (err) console.error(err);
    res.redirect('/admin/dashboard');
  });
});

// Delete game
app.post('/admin/games/delete/:id', (req, res) => {
  db.run('DELETE FROM games WHERE id = ?', [req.params.id], err => {
    if (err) console.error(err);
    res.redirect('/admin/dashboard');
  });
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server started on http://localhost:${PORT}`));
