const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(session({secret:'supersecretstring', resave:false, saveUninitialized:true}));
app.use(express.static('.'));
const USERS_FILE = './users.json';

function readUsers(){ return JSON.parse(fs.readFileSync(USERS_FILE)); }
function writeUsers(users){ fs.writeFileSync(USERS_FILE, JSON.stringify(users, null,2)); }

app.post('/auth/check',(req,res)=>{
  const {email,username} = req.body;
  const users = readUsers();
  if(users.find(u=>u.email===email)) return res.json({available:false,message:'Email already exists'});
  if(users.find(u=>u.username===username)) return res.json({available:false,message:'Username already exists'});
  res.json({available:true});
});

app.post('/auth/register', async (req,res)=>{
  const {email,username,password} = req.body;
  const users = readUsers();
  const hashed = await bcrypt.hash(password,10);
  const user = {email,username,password:hashed};
  users.push(user);
  writeUsers(users);
  req.session.user = {username,email};
  res.json({success:true,user:{username,email}});
});

app.post('/auth/login', async (req,res)=>{
  const {usernameOrEmail,password} = req.body;
  const users = readUsers();
  const user = users.find(u=>u.username===usernameOrEmail || u.email===usernameOrEmail);
  if(!user) return res.json({success:false,message:'Invalid Email or Password'});
  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.json({success:false,message:'Invalid Email or Password'});
  req.session.user = {username:user.username,email:user.email};
  res.json({success:true,user:{username:user.username,email:user.email}});
});

app.get('/auth/user',(req,res)=>{
  if(req.session.user) return res.json({loggedIn:true,...req.session.user});
  res.json({loggedIn:false});
});

app.get('/logout',(req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
