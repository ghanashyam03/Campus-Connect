const express = require('express');
const mysql = require('mysql');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  })
);

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'ghanalm10',
  database: 'project',
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname , 'public' , 'index.html'));
});

app.get('/signup', function (req, res) {
  res.sendFile(path.join(__dirname , 'public' , 'signup.html'));
});

app.post('/signup', function (req, res) {
  const { username, email, password } = req.body;
  if (username && email && password) {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.log(err);
        res.redirect('/signup');
      } 
      else {
        const sql =
          'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        connection.query(sql, [username, email, hash], (err, result) => {
          if (err) {
            console.log(err);
            res.redirect('/signup');
          } else {
            console.log(result);
            res.redirect('/');
          }
        });
      }
    });
  } else {
    res.redirect('/signup');
  }
});

app.get('/login', function (req, res) {
  if(req.session.loggedin){
    res.redirect('/sig')
  }else{
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});



app.post('/login', function (req, res) {
  const { username, password } = req.body;
  if (username && password) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    connection.query(sql, [username], (err, result) => {
      if (err) {
        console.log(err);
        res.redirect('/login');
      } else if (result.length === 1) {
        bcrypt.compare(
          password,
          result[0].password,
          (err, bcryptRes) => {
            if (bcryptRes) {
              req.session.loggedin = true;
              req.session.username = username;
              
              res.redirect('/sig');
            } else {
              const alert = `<script>window.alert("You entered invalid password");</script>`
              res.send(alert)
            }
          }
          );
        } else {
        const alert = `<script>window.alert("You entered invalid username");</script>`
        res.send(alert)
      }
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/home', function (req, res) {
  
  const username = req.session.username;
  if(username){
    res.sendFile(path.join(__dirname , 'public' , 'login.html'));
    // res.send(`Welcome back to CAMPUS CONNECT, ${username}!`);
  }else{
    res.redirect('/')
  }
   
  }
);

app.get('/sig', (req, res) => {
  if(!req.session.loggedin){
    res.redirect('/login')
  }else{
    res.sendFile(path.join(__dirname , 'public' , 'sig.html'));
  }
})

app.post('/sig', function (req, res) {
  const { name, dob, interests } = req.body;
  const username = req.session.username;
  if (name && dob) {
      const sql = ' insert into profile (username, name, dob, interets) values (?, ?, ?, ?)';
      connection.query(sql, [username, name, dob, interests.join(',')], (err, result) => {
          if(err) {
              console.log(err);
              res.redirect('/sig');

          }
          else {
              console.log(result);
              res.redirect('/');
          }
      })
  }
  else {
      res.redirect('/sig');
  }
});

const port = 5000;

app.listen(port, function () {
  console.log(`Server started on port ${port}`);
});
