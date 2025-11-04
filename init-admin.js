// run: node init-admin.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const readline = require('readline');

const db = new sqlite3.Database('./data.db');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Admin username: ', username => {
  rl.question('Admin password: ', async password => {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      'INSERT OR REPLACE INTO admins (id, username, password_hash) VALUES ((SELECT id FROM admins WHERE username = ?), ?, ?)',
      [username, username, hash],
      function (err) {
        if (err) console.error('Error:', err.message);
        else console.log('✅ Admin user created/updated successfully!');
        db.close();
        rl.close();
      }
    );
  });
});
