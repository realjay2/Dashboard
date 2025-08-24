const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// JSON file to store users
const USERS_FILE = path.join(__dirname, 'users.json');

// Ensure users.json exists
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));

app.use(bodyParser.json());
app.use(session({
  secret: 'supersecretstring',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 } // 1 day
}));

// Helper functions
function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Register route
app.post('/auth/register', async (req, res) => {
  const { email, username, password } = req.body;
  if(!email || !username || !password) return res.json({ success:false, message:'All fields required' });

  const users = getUsers();
  if(users.find(u=>u.username===username)) return res.json({ success:false, message:'Username already exists' });
  if(users.find(u=>u.email===email)) return res.json({ success:false, message:'Email already exists' });

  const hash = await bcrypt.hash(password, 10);
  const user = { email, username, password: hash };
  users.push(user);
  saveUsers(users);

  req.session.user = { username: user.username, email: user.email };
  res.json({ success:true, user: req.session.user });
});

// Duplicate check route
app.post('/auth/check', (req, res) => {
  const { email, username } = req.body;
  const users = getUsers();
  if(users.find(u=>u.username===username)) return res.json({ available:false, message:'Username taken' });
  if(users.find(u=>u.email===email)) return res.json({ available:false, message:'Email taken' });
  res.json({ available:true });
});

// Login route
app.post('/auth/login', async (req,res) => {
  const { usernameOrEmail, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.username===usernameOrEmail || u.email===usernameOrEmail);
  if(!user) return res.json({ success:false, message:'Invalid Email or Password' });

  const match = await bcrypt.compare(password, user.password);
  if(!match) return res.json({ success:false, message:'Invalid Email or Password' });

  req.session.user = { username:user.username, email:user.email };
  res.json({ success:true, user: req.session.user });
});

// Get current session user
app.get('/auth/user', (req,res) => {
  if(req.session.user) return res.json({ loggedIn:true, user:req.session.user });
  res.json({ loggedIn:false });
});

// Logout route
app.get('/logout', (req,res) => {
  req.session.destroy();
  res.json({ success:true });
});

app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
