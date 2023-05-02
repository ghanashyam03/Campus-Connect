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
              req.session.loggedin = true;
              req.session.username = username;
              res.redirect('/info');
            }
          });
        }
      });
    } else {
      res.redirect('/signup');
    }
  });


app.get('/login', function (req, res) {
  
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
    
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
                
                res.redirect('/home');
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
      res.send(`Welcome back to CAMPUS CONNECT, ${username}!`);
    }
    else{
      res.redirect('/')
    }
     
    }
  );
  
  app.get('/info', (req, res) => {
    if(!req.session.loggedin){
      res.redirect('/signup');
    }else{
      res.sendFile(path.join(__dirname , 'public' , 'info.html'));
    }
  });
  
app.post('/info', function (req, res) {
    const { full, phone, dateo, course, semester, ending } = req.body;
    const username = req.session.username;
    const sql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(sql, [username], (err, userids) => {
        if (full && dateo && phone && course && semester && ending ) {
            const sql2 = 'INSERT INTO profile (userid, name, dob, phone, course, semester, ending) VALUES (?, ?, ?, ?, ?, ?, ?)';
            const userid = userids[0].userid;
            connection.query(sql2, [userid, full, dateo, phone, course, semester, ending], (err, result) => {
                if (err) {
                    console.log(err);
                    res.redirect('/info');
                } else {
                    console.log(result);
                    req.session.info = true;
                    res.redirect('/moreinfo');
                }
            });
        } else {
            res.redirect('/info');
        }
    });  
});


app.get('/moreinfo', (req, res) => {
    if(!req.session.info){
      res.redirect('/signup');
    }else{
      res.sendFile(path.join(__dirname , 'public' , 'moreinfo.html'));
    }
  });
  
  app.post('/moreinfo', function (req, res) {
    const { country, state, accommodation, hostel } = req.body;
    console.log("country:", country);
    console.log("state:", state);
    console.log("accommodation:", accommodation);
    console.log("hostel:", hostel);
    const username = req.session.username;
    console.log("username:", username);
    const sql = 'SELECT userid FROM users WHERE username = ?';
    console.log("sql:", sql);
    connection.query(sql, [username], (err, userids) => {
        if (country && accommodation ) {
            const sql2 = 'INSERT INTO info (country, state, accommodation, hostel, userid) VALUES (?, ?, ?, ?, ?)';
            const userid = userids[0].userid;
            console.log("userid:", userid);
            connection.query(sql2, [country, state, accommodation, hostel, userid], (err, result) => {
                if (err) {
                    console.log(err);
                    res.redirect('/moreinfo');
                } else {
                    console.log(result);
                    res.redirect('/int');
                }
            });
        } else {
            console.log("Fields not complete!");
            res.redirect('/moreinfo');
        }
    });  
});


app.get('/int', (req, res) => {
  if(!req.session.info){
    res.redirect('/signup');
  }else{
    res.sendFile(path.join(__dirname , 'public' , 'int.html'));
  }
});

app.post('/int', function (req, res) {
  const { interest } = req.body;
  const username = req.session.username;
  const sql = 'SELECT userid FROM users WHERE username = ?';
  connection.query(sql, [username], (err, userids) => {
      if (interest ) {
          const sql2 = 'INSERT INTO interests (userid, interest) VALUES (?, ?)';
          const userid = userids[0].userid;
          connection.query(sql2, [userid, interest.join(',')], (err, result) => {
              if (err) {
                  console.log(err);
                  res.redirect('/int');
              } else {
                  console.log(result);
                  req.session.info = true;
                  res.redirect('/');
              }
          });
      } else {
          res.redirect('/int');
    }
  });  
});

const port = 5000;

app.listen(port, function () {
  console.log(`Server started on port ${port}`);
});