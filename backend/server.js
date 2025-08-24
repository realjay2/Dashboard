const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));

const app = express();
const PORT = config.server.port || 3000;

app.use(express.json());
app.use(session({
  secret: config.server.sessionSecret,
  resave: false,
  saveUninitialized: false,
}));

// Enable CORS for frontend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Discord OAuth2 login
app.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: 'identify email',
    prompt: 'consent'
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// OAuth2 callback
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided');

  const data = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.discord.redirectUri,
  });

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: data,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const tokenJson = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const user = await userRes.json();

    req.session.user = user;

    // Redirect to frontend with session
    res.redirect(`${config.discord.frontendUrl}?logged_in=true`);
  } catch (err) {
    console.error(err);
    res.send('Error fetching Discord user');
  }
});

// API to get user info
app.get('/api/me', (req, res) => {
  if (req.session.user) return res.json({ user: req.session.user });
  res.status(401).json({ error: 'Not logged in' });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
