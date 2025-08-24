const express = require('express');
const session = require('express-session');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const config = require('./config.json');

const app = express();
const PORT = config.server.port || 3000;

app.use(session({
  secret: config.server.sessionSecret,
  resave: false,
  saveUninitialized: false
}));

// Redirect user to Discord OAuth2
app.get('/auth/discord', (req, res) => {
  const redirect = encodeURIComponent(config.discord.redirectUri);
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${redirect}&response_type=code&scope=identify`);
});

// Handle OAuth2 callback
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code provided");

  try {
    const data = new URLSearchParams();
    data.append('client_id', config.discord.clientId);
    data.append('client_secret', config.discord.clientSecret);
    data.append('grant_type', 'authorization_code');
    data.append('code', code);
    data.append('redirect_uri', config.discord.redirectUri);
    data.append('scope', 'identify');

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: data,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const tokenData = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    req.session.user = {
      username: userData.username,
      discriminator: userData.discriminator,
      id: userData.id,
      avatarURL: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
    };
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.send('Error during Discord authentication');
  }
});

// Get logged-in user
app.get('/auth/user', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, ...req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
