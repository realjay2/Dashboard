const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const config = require('./config.json');

const app = express();
const PORT = config.server.port;

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Express session
app.use(session({
  secret: config.server.sessionSecret,
  resave: false,
  saveUninitialized: true,
}));

// OAuth2 login redirect
app.get('/auth/discord', (req, res) => {
  const redirect = encodeURIComponent(config.discord.redirectUri);
  const url = `https://discord.com/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${redirect}&response_type=code&scope=identify`;
  res.redirect(url);
});

// OAuth2 callback
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  try {
    // Exchange code for access token
    const tokenResp = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.discord.redirectUri
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResp.data.access_token;

    // Get user info
    const userResp = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Save user in session
    req.session.user = userResp.data;
    res.redirect('/'); // redirect to frontend homepage
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('OAuth2 error');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// API endpoint for frontend to get user
app.get('/auth/user', (req, res) => {
  if (req.session.user) {
    const { username, discriminator, id, avatar } = req.session.user;
    res.json({ loggedIn: true, username, discriminator, id, avatar });
  } else {
    res.json({ loggedIn: false });
  }
});

// Serve frontend index for any route (for SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
