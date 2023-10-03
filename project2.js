const express = require('express');
const mysql = require('mysql');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { error } = require('console');
const http = require('http');
const socketIO = require('socket.io');
const app = express();
const util = require('util');


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


const connectionQueryAsync = util.promisify(connection.query).bind(connection);



app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname , 'public' , 'LandingPage', 'landing.html'));
  });
  
  app.get('/signup', function (req, res) {
    res.sendFile(path.join(__dirname , 'public' , 'logosign' , 'logsign.html'));
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

  const checkLoggedIn = async(req, res, next) => {
    try  {
      console.log(req.session.loggedin === "true")
      if(req.session.loggedin === true){
        res.redirect('/feed')
      }else{
        next()
      }
    } catch (error) {
      console.log(error)
    }
  }

app.get('/login', checkLoggedIn, function (req, res) {
   
    res.sendFile(path.join(__dirname, 'public', 'logosign', 'logsign.html'));
    
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
          bcrypt.compare(password, result[0].password, (err, bcryptRes) => {
            if (bcryptRes) {
              req.session.loggedin = true;
              req.session.username = username;
  
              res.redirect('/feed');
            } else {
              const alert = `<script>window.alert("You entered an invalid password");</script>`;
              res.send(alert);
            }
          });
        } else {
          const alert = `<script>window.alert("You entered an invalid username");</script>`;
          res.send(alert);
        }
      });
    } else {
      res.redirect('/login');
    }

  });
  

  
  

  
const requireLogin = (req, res, next) => {
  if (req.session.loggedin) {

    next();
  } else {
   
    res.redirect('/login');
  }
};


  
  

  app.get('/feed', requireLogin, function (req, res) {
  const username = req.session.username;

  const sql = 'SELECT userid FROM users WHERE username = ?';
  connection.query(sql, [username], (err, userids) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }

    const userid = userids[0].userid;

    const sql3 = 'SELECT frienduserid FROM friends WHERE userid = ?';
    connection.query(sql3, [userid], (err1, friends) => {
      if (err1) {
        console.error('Error fetching data from MySQL database: ', err1);
        res.status(500).send('Internal server error');
        return;
      }

      const friendUserIds = friends.map((friend) => friend.frienduserid);
      if (friendUserIds.length === 0) {
        // Redirect to the people page to connect with others
        res.redirect('/people');
        return;
      }

      const placeholders = friendUserIds.map(() => '?').join(',');
      const query = `
        SELECT posts.postid, posts.title, posts.content, posts.topic, posts.interests, users.username, COUNT(likes.likeid) AS likeCount
        FROM posts
        INNER JOIN users ON posts.userid = users.userid
        LEFT JOIN likes ON posts.postid = likes.postid
        WHERE posts.userid IN (${placeholders})
        GROUP BY posts.postid, posts.title, posts.content, posts.topic, posts.interests, users.username
      `;
      const queryParams = friendUserIds;
      connection.query(query, queryParams, (error, results) => {
        if (error) {
          console.error('Error fetching data from MySQL database: ', error);
          res.status(500).send('Internal server error');
          return;
        }

        let postsHTML = '';
        if (results.length === 0) {
          postsHTML = '<p>Nothing new here.</p>';
        } else {
          for (const post of results) {
            const likeButton = `
              <form method="POST" action="/like">
                <input type="hidden" name="postid" value="${post.postid}">
                <button class="like-button" type="submit">${post.likeCount > 0 ? 'Unlike' : 'Like'}</button>
              </form>
            `;

            postsHTML += `
              <div class="post">
                <div class="post-info-container">
                  <h1><b>${post.title}</b></h1>
                  <div class="user-topic">
                    <p class="user-info"><strong>User:</strong> ${post.username}</p>
                    <p class="topic-info"><strong>Topic:</strong> ${post.topic}</p>
                    <p class="interest-info"><strong>Interest:</strong> <span class="interest-frame">${post.interests}</span></p>
                  </div>
                </div>
                <p><b>${post.content}</b></p>
                <div class="post-info">
                  <span class="like-count">Likes: ${post.likeCount}</span>
                  ${likeButton}
                </div>
              </div>
            `;
          }
        }
  
          res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Home</title>
            <link rel="stylesheet" href="home.css">
            <link href='https://fonts.googleapis.com/css?family=Outfit' rel='stylesheet'>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
          </head>
          <body>
            <div class="sidebar">
              <div class="image-container">
                <img class="image.logo" src="./Images/logosymbol.png" alt="Logo">
              </div>
              <a href="/feed"><i class="fas fa-home"></i> Home</a>
              <a href="/people"><i class="fas fa-users"></i> People</a>
              <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
              <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
              <a href="/search"><i class="fas fa-search"></i> Search</a>
              <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
              <a href="/profile"><i class="fas fa-user"></i> Profile</a>
            </div>
          
            <div class="content">
              <div class="logo-and-profile">
                <h1><b>CAMPUS CONNECT</b></h1>
                <div class="user-profile">
      
                    
              </div>
              <div class="new-post">
                
                  ${postsHTML}
                </div>
              </div>
              </body>
            </html>
          `);
        });
      });
    });
  });
  
  
  

  
  
  app.get('/chat', requireLogin, async function (req, res) {
    const username = req.session.username;
  
    try {
      const userQuery = 'SELECT userid FROM users WHERE username = ?';
      const userids = await connectionQueryAsync(userQuery, [username]);
      const currentUserID = userids[0].userid;
  
      const chatQuery = `
  SELECT DISTINCT users.userid, users.username, profile_photos.filename
  FROM users
  LEFT JOIN chat ON users.userid = chat.receiverid OR users.userid = chat.senderid
  LEFT JOIN profile_photos ON users.userid = profile_photos.userid
  WHERE (chat.receiverid = ? OR chat.senderid = ?) AND users.userid != ?
`;

      const chats = await connectionQueryAsync(chatQuery, [currentUserID, currentUserID, currentUserID]);
  
      // Generate dynamic HTML for the chat list
      let chatListHTML = '';
      for (const chat of chats) {
        const profilephoto = chat.filename ? `/${chat.filename}` : '/default.jpg';
        chatListHTML += `
          <div class="friend">
            <img src="uploads${profilephoto}" alt="Friend">
            <a href="/chat/${chat.userid}">${chat.username}</a>
          </div>
        `;
      }
  
        // Send the dynamic HTML response
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Chat List</title>
            <link rel="stylesheet" href="chatlist.css">
            <link href='https://fonts.googleapis.com/css?family=Outfit' rel='stylesheet'>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
          </head>
          <body>
            <div class="sidebar">
              <div class="image-container">
                <img class="image.logo" src="./Images/logosymbol.png" alt="Logo">
              </div>
              <a href="/feed"><i class="fas fa-home"></i> Home</a>
              <a href="/people"><i class="fas fa-users"></i> People</a>
              <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
              <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
              <a href="/search"><i class="fas fa-search"></i> Search</a>
              <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
              <a href="/profile"><i class="fas fa-user"></i> Profile</a>
            </div>
  
            <div class="content">
              <div class="logo-and-profile">
                <h1><b>CAMPUS CONNECT</b></h1>
                <a href="user_profile.html" class="home-icon"><i class="fas fa-home"></i></a>
              </div>
              <div class="chat-section">
                <!-- User Profile Name -->
                <div class="profile-chat-container">
                  <p>Messages</p>
                </div>
                <main>
                  <div class="friends-list">
                    ${chatListHTML}
                  </div>
                </main>
              </div>
            </div>
          </body>
          </html>
          `);
        } catch (err) {
          console.error('Error fetching data from MySQL database: ', err);
          return res.status(500).send('Internal server error');
        }
      });
  

  

  
  

  
 
// Assuming you have already set up the necessary imports and configurations for the app and connection to the database.

app.get('/chat/:userid', requireLogin, function (req, res) {
  const otherUserID = req.params.userid;
  const username = req.session.username;

  const sql = 'SELECT userid FROM users WHERE username = ?';
  connection.query(sql, [username], (err, userids) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      return res.status(500).send('Internal server error');
    }

    const currentUserID = userids[0].userid;
    const sql2 = `
      SELECT chat.*, 
             sender.username AS senderusername, 
             receiver.username AS receiverusername
      FROM chat
      INNER JOIN users AS sender ON sender.userid = chat.senderid
      INNER JOIN users AS receiver ON receiver.userid = chat.receiverid
      WHERE (chat.senderid = ? AND chat.receiverid = ?) OR (chat.senderid = ? AND chat.receiverid = ?)
      ORDER BY chat.timestamp ASC
    `;
    connection.query(sql2, [currentUserID, otherUserID, otherUserID, currentUserID], (err, messages) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        return res.status(500).send('Internal server error');
      }

      let otherusername = '';
      if (messages.length > 0) {
        if (messages[0].senderid === currentUserID && messages[0].receiverid === currentUserID) {
          otherusername = username; // Current user is chatting with themselves
        } else {
          otherusername = messages[0].senderid === currentUserID ? messages[0].receiverusername : messages[0].senderusername;
        }
      } else {
        otherusername = username; // No messages, current user is chatting with themselves
      }

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Chat Box2</title>
            <link rel="stylesheet" href="../chat.css">
            <link href='https://fonts.googleapis.com/css?family=Outfit' rel='stylesheet'>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
          </head>
          <body>
          <div class="sidebar">
          <div class="image-container">
            <img class="image.logo" src="./Images/logosymbol.png" alt="Logo">
          </div>
          <a href="/feed"><i class="fas fa-home"></i> Home</a>
              <a href="/people"><i class="fas fa-users"></i> People</a>
              <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
              <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
              <a href="/search"><i class="fas fa-search"></i> Search</a>
              <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
              <a href="/profile"><i class="fas fa-user"></i> Profile</a>
        </div>
      
         <div class="content">
          <div class="logo-and-profile">
            <h1><b>CAMPUS CONNECT</b></h1>
            <a href="user_profile.html" class="home-icon"><i class="fas fa-home"></i></a>
          </div>
            <div class="chat-box" id="chatbox">
              <!-- Friend's Name and Profile Picture -->
              <div class="friend-profile">
                
                <h3>${otherusername}</h3>
              </div>
              <!-- Chat Messages -->
              <div class="chat-messages" id="chat-messages">
                ${messages.map((message) => {
                  if (message.senderid === currentUserID) {
                    // Message sent by the current user
                    return `
                      <div class="message user">
                        <p>${message.message}</p>
                      </div>
                    `;
                  } else {
                    // Message sent by the other user
                    return `
                      <div class="message friend">
                        <p>${message.message}</p>
                      </div>
                    `;
                  }
                }).join('')}
              </div>
              <!-- Message Input Form -->
              <form action="/chatwith/${otherUserID}" method="post" class="message-input">
                <input type="text" name="message" placeholder="Type your message here">
                <button type="submit">Send</button>
              </form>
            </div>
          </body>
          <script>
                const chatbox = document.getElementById('chatbox')
                chatbox.scrollTop = chatbox.scrollHeight
          </script>
        </html>
      `);
    });
  });
});

app.post('/chatwith/:userid', requireLogin, function (req, res) {
  const otherUserID = req.params.userid;
  const message = req.body.message;
  const username = req.session.username;

  const sql = 'SELECT userid FROM users WHERE username = ?';
  connection.query(sql, [username], (err, userids) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }

    const currentUserID = userids[0].userid;
    const sql2 = 'INSERT INTO chat (senderid, receiverid, message) VALUES (?, ?, ?)';
    connection.query(sql2, [currentUserID, otherUserID, message], (err) => {
      if (err) {
        console.error('Error inserting data into MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }

      res.redirect(`/chat/${otherUserID}`);
    });
  });
});

      
  
  
  



  
app.post('/like', function (req, res) {
  const username = req.session.username;
  const postid = req.body.postid;

  const sql = 'SELECT userid FROM users WHERE username = ?';
  connection.query(sql, [username], function (err, userids) {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }

    const userid = userids[0].userid;

    const selectQuery = 'SELECT likeid FROM likes WHERE postid = ? AND userid = ?';
    connection.query(selectQuery, [postid, userid], function (error, like) {
      if (error) {
        console.error('Error fetching data from MySQL database: ', error);
        res.status(500).send('Internal server error');
        return;
      }

      if (like.length === 0) {
        // User wants to like the post
        const insertQuery = 'INSERT INTO likes (postid, userid) VALUES (?, ?)';
        connection.query(insertQuery, [postid, userid], function (insertError) {
          if (insertError) {
            console.error('Error inserting data into MySQL database: ', insertError);
            res.status(500).send('Internal server error');
          } else {
            // Handle the successful like
            // Get post owner's user ID from the posts table
            const postOwnerQuery = 'SELECT userid FROM posts WHERE postid = ?';
            connection.query(postOwnerQuery, [postid], function (ownerError, ownerResults) {
              if (ownerError) {
                console.error('Error fetching post owner data from MySQL database: ', ownerError);
                res.status(500).send('Internal server error');
                return;
              }

              const postOwnerId = ownerResults[0].userid;

              // Update notification for the post owner
              const notificationQuery = 'INSERT INTO notifications (userid, senderid, type, message) VALUES (?, ?, ?, ?)';
              const notificationValues = [postOwnerId, userid, 'like', 'Your post has been liked by ' + username];
              connection.query(notificationQuery, notificationValues, function (notificationError) {
                if (notificationError) {
                  console.error('Error inserting notification into MySQL database: ', notificationError);
                  res.status(500).send('Internal server error');
                } else {
                  res.redirect('/feed');
                }
              });
            });
          }
        });
      } else {
        // User wants to unlike the post
        const deleteQuery = 'DELETE FROM likes WHERE likeid = ?';
        connection.query(deleteQuery, [like[0].likeid], function (deleteError) {
          if (deleteError) {
            console.error('Error deleting data from MySQL database: ', deleteError);
            res.status(500).send('Internal server error');
          } else {
            // Handle the successful unlike
            res.redirect('/feed');
          }
        });
      }
    });
  });
});

  
  
  

  
app.get('/search', requireLogin, async function (req, res) {
  const searchedUsername = req.query.username;

  try {
    const currentUser = req.session.username;
    const currentUserSql = 'SELECT userid FROM users WHERE username = ?';
    const currentUserIds = await connectionQueryAsync(currentUserSql, [currentUser]);
    const currentUserId = currentUserIds[0].userid;

    const sql =
      `SELECT u.userid, u.username, p.name, profile_photos.filename
       FROM users u 
       INNER JOIN profile p ON u.userid = p.userid
       LEFT JOIN profile_photos ON u.userid = profile_photos.userid
       WHERE u.username LIKE ?`;
    const results = await connectionQueryAsync(sql, [searchedUsername + '%']);

    let searchResultsHTML = '';
    if (results.length === 0) {
      searchResultsHTML = '<p>No results found.</p>';
    } else {
      const friendUserIds = results.map((result) => result.userid);

      // Check if the current user is following each user in the search results
      const isFollowingSql = 'SELECT frienduserid FROM friends WHERE userid = ? AND frienduserid IN (?)';
      const followingResults = await connectionQueryAsync(isFollowingSql, [currentUserId, friendUserIds]);
      const followingUserIds = followingResults.map((result) => result.frienduserid);

      for (const result of results) {
        const profilephoto = result.filename ? `/${result.filename}` : '/default.jpg';
        const isFollowingUser = followingUserIds.includes(result.userid);
        const isCurrentUser = result.userid === currentUserId;

        searchResultsHTML += `
          <div class="card">
            <div class="profile-photo">
              <img src="/uploads${profilephoto}" alt="Image 3">
            </div>
            <a href="/friendprofile/${result.userid}"><h2>@${result.username}</h2></a>
            <p>${result.name}</p>
            <form method="POST" action="/befri">
              <input type="hidden" name="friendUsername" value="${result.username}">
              <button type="submit" class="follow-button" ${
                isCurrentUser ? 'disabled' : ''}>
                ${isCurrentUser ? 'You' : isFollowingUser ? 'Following' : 'Follow'}
              </button>
            </form>
          </div>
        `;
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>User Search</title>
        <link rel="stylesheet" href="search1.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
      </head>
      <body>
      <div class="sidebar">
      <div class="image-container">
    <img class="image-logo" src="./Images/logo1.png" alt="Logo">
    </div>

    <a href="/feed"><i class="fas fa-home"></i> Home</a>
    <a href="/people"><i class="fas fa-users"></i> People</a>
    <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
    <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
    <a href="/search"><i class="fas fa-search"></i> Search</a>
    <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
    <a href="/profile"><i class="fas fa-user"></i> Profile</a>
      </div>
        <div class="campus">
          <div class="logo-and-profile">
            <h1><b>CAMPUS CONNECT</b></h1>
            <a href="user_profile.html" class="home-icon"><i class="fas fa-home"></i></a>
          </div>
          <div class="content">
            <div class="similar"> 
              <h1>User Search</h1>
              <form action="/search" method="GET">
                <input type="text" name="username" placeholder="Enter @username" />
                <button type="submit">Search</button>
              </form>
            </div>
            <div class="card-container">
              ${searchResultsHTML}
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Error fetching data from MySQL database: ', err);
    res.status(500).send('Internal server error');
  }
});
  
app.get('/friendprofile/:userid', requireLogin, function (req, res) {
  const profileUserId = req.params.userid;
  const currentUser = req.session.username;
  const currentUserSql = 'SELECT userid, username FROM users WHERE username = ?';
  connection.query(currentUserSql, [currentUser], (err, currentUserData) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }

    const currentUserId = currentUserData[0].userid;
    const isCurrentUser = currentUserId === parseInt(profileUserId); // Parse profileUserId to integer for comparison
    const username = currentUserData[0].username;

    const getDetailsQuery = `
      SELECT u.username, p.name, COUNT(friend.frienduserid) AS friendcount,
      CASE WHEN i.interest1 IS NOT NULL THEN i.interest1 ELSE '' END AS interest1,
      CASE WHEN i.interest2 IS NOT NULL THEN i.interest2 ELSE '' END AS interest2,
      CASE WHEN i.interest3 IS NOT NULL THEN i.interest3 ELSE '' END AS interest3,
      CASE WHEN i.interest4 IS NOT NULL THEN i.interest4 ELSE '' END AS interest4,
      CASE WHEN i.interest5 IS NOT NULL THEN i.interest5 ELSE '' END AS interest5,
      f.postid, f.title, f.content, f.topic, ph.filename, p.sem, p.stream, u.email, f.interests
      FROM users u
      JOIN interests i ON u.userid = i.userid
      JOIN profile p ON p.userid = u.userid
      LEFT JOIN friends friend ON friend.userid = u.userid
      LEFT JOIN posts f ON f.userid = u.userid
      LEFT JOIN profile_photos ph ON ph.userid = u.userid
      WHERE u.userid = ?
      GROUP BY u.userid, u.username, p.name, i.interest1, i.interest2, i.interest3, i.interest4, i.interest5, f.postid, f.title, f.content, f.topic, ph.filename, p.sem, p.stream, u.email, f.interests
    `;
    connection.query(getDetailsQuery, [profileUserId], (err, profileResults) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }

      const postsByUser = {};
      profileResults.forEach((result) => {
        const {
          username,
          name,
          friendcount,
          interest1,
          interest2,
          interest3,
          interest4,
          interest5,
          postid,
          title,
          content,
          topic,
          filename,
          sem,
          stream,
          email,
          interests,
        } = result;

        if (!postsByUser[username]) {
          postsByUser[username] = {
            name,
            friendcount,
            interests: [interest1, interest2, interest3, interest4, interest5].filter((interest) => interest !== ''),
            posts: [],
            profilePhoto: filename ? `/${filename}` : '/default.jpg',
            sem,
            stream,
            email,
          };
        }

        if (title && content && topic) {
          postsByUser[username].posts.push({
            title,
            content,
            topic,
            postid,
            interests,
          });
        }
      });

      const isFollowingUserQuery = 'SELECT COUNT(*) AS isFollowing FROM friends WHERE userid = ? AND frienduserid = ?';
      connection.query(isFollowingUserQuery, [currentUserId, profileUserId], (err, followingResult) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          res.status(500).send('Internal server error');
          return;
        }

        const isFollowingUser = followingResult[0].isFollowing === 1;

        const htmlPosts = Object.keys(postsByUser).map((username) => {
          const { name, friendcount, interests, posts, profilePhoto, sem, stream, email } = postsByUser[username];

          const interestsHTML = interests.map((interest) => `<li>${interest}</li>`).join('');

          let postsHTML = '';
          if (posts.length > 0) {
            postsHTML = posts
              .map(
                (post) => `
                  <div class="post">
                    <h3>${post.title}</h3>
                    <h5>${post.topic}</h5>
                    <p>${post.content}</p>
                    <p>${post.interests}</p>
                  </div>
                `
              )
              .join('');
          } else {
            postsHTML = '<p>No posts yet.</p>';
          }

          return `
            <div class="profile">
              <h2>@${username}</h2>
              <h3>${name}</h3>
              <p>Friends: <span id="friends">${friendcount}</span></p>
              <p><b>Semester:</b> ${sem}</p>
              <p><b>Stream:</b> ${stream}</p>
              <p><b>Email Id:</b> ${email}</p>
              <h3>Interests:</h3>
              <ul id="interests">
                ${interestsHTML}
              </ul>

              <form method="POST" action="/profilefollow">
                <input type="hidden" name="friendUsername" value="${username}">
                <input type="hidden" name="profileUserId" value="${profileUserId}">
                <button type="submit" class="follow-button" ${isCurrentUser ? 'disabled' : ''}>
                  ${isCurrentUser ? 'You' : isFollowingUser ? 'Following' : 'Follow'}
                </button>
              </form>

              <button type="submit"><a href="/chat/${profileUserId}">Chat</a></button>
            </div>

            <h2>All Posts:</h2>
            ${postsHTML}
          `;
        });

        res.send(`
          <html>
            <head>
              <title>Profile</title>
              <link rel="stylesheet" type="text/css" href="/friendprofile.css">
            </head>
            <body>
            <div class="sidebar">
              <div class="image-container">
                < img class="logosymbol.pn" src="./Images/logo1.png" alt="Logo">
              </div>
              <a href="/feed"><i class="fas fa-home"></i> Home</a>
              <a href="/people"><i class="fas fa-users"></i> People</a>
              <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
              <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
              <a href="/search"><i class="fas fa-search"></i> Search</a>
              <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
              <a href="/profile"><i class="fas fa-user"></i> Profile</a>
            </div>
              ${htmlPosts.join('')}
            </body>
          </html>
        `);
      });
    });
  });
});



  
  
  app.post('/profilefollow', function (req, res) {
    console.log('Profile follow route called');
    const currentUser = req.session.username;
    const friendUsername = req.body.friendUsername;
  
    const currentUserSql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(currentUserSql, [currentUser], function (err, currentUserIds) {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
      if (currentUserIds.length === 0) {
        console.error('Current user not found in the database.');
        res.status(404).send('User not found');
        return;
      }
      const currentUserId = currentUserIds[0].userid;
      console.log('Current user ID:', currentUserId);
  
      const friendUserSql = 'SELECT userid FROM users WHERE username = ?';
      connection.query(friendUserSql, [friendUsername], function (err, friendUserIds) {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          res.status(500).send('Internal server error');
          return;
        }
        if (friendUserIds.length === 0) {
          console.error('Friend user not found in the database.');
          res.status(404).send('User not found');
          return;
        }
        const friendUserId = friendUserIds[0].userid;
        console.log('Friend user ID:', friendUserId);
  
        const insertSql = 'INSERT INTO friends (userid, frienduserid) VALUES (?, ?)';
        connection.query(insertSql, [currentUserId, friendUserId], function (error, results) {
          if (error) {
            console.error('Error inserting data into MySQL database: ', error);
            res.status(500).send('Internal server error');
          } else {
            // Handle the successful following
            // Update notification for both users
            const currentUserNotificationQuery = 'INSERT INTO notifications (userid, senderid, type, message) VALUES (?, ?, ?, ?)';
            const currentUserNotificationValues = [currentUserId, friendUserId, 'friend_request', 'You are now friends with ' + friendUsername];
            const friendUserNotificationQuery = 'INSERT INTO notifications (userid, senderid, type, message) VALUES (?, ?, ?, ?)';
            const friendUserNotificationValues = [friendUserId, currentUserId, 'friend_request', currentUser + ' is now following you'];
            connection.query(currentUserNotificationQuery, currentUserNotificationValues, function (notificationError) {
              if (notificationError) {
                console.error('Error inserting notification into MySQL database: ', notificationError);
                res.status(500).send('Internal server error');
              } else {
                connection.query(friendUserNotificationQuery, friendUserNotificationValues, function (notificationError) {
                  if (notificationError) {
                    console.error('Error inserting notification into MySQL database: ', notificationError);
                    res.status(500).send('Internal server error');
                  } else {
                    res.redirect(`/friendprofile/${req.body.profileUserId}`);
                  }
                });
              }
            });
          }
        });
      });
    });
  });
  
  
  
  
  
  
  app.post('/befri', function (req, res) {
    const currentUser = req.session.username;
    const friendUsername = req.body.friendUsername;
  
    const currentUserSql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(currentUserSql, [currentUser], function (err, currentUserIds) {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
      if (currentUserIds.length === 0) {
        console.error('Current user not found in the database.');
        res.status(404).send('User not found');
        return;
      }
      const currentUserId = currentUserIds[0].userid;
  
      const friendUserSql = 'SELECT userid FROM users WHERE username = ?';
      connection.query(friendUserSql, [friendUsername], function (err, friendUserIds) {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          res.status(500).send('Internal server error');
          return;
        }
        if (friendUserIds.length === 0) {
          console.error('Friend user not found in the database.');
          res.status(404).send('User not found');
          return;
        }
        const friendUserId = friendUserIds[0].userid;
  
        const insertSql = 'INSERT INTO friends (userid, frienduserid) VALUES (?, ?)';
        connection.query(insertSql, [currentUserId, friendUserId], function (error, results) {
          if (error) {
            console.error('Error inserting data into MySQL database: ', error);
            res.status(500).send('Internal server error');
          } else {
            // Handle the successful befriending
            // Update notification for both users
            const currentUserNotificationQuery = 'INSERT INTO notifications (userid, senderid, type, message) VALUES (?, ?, ?, ?)';
            const currentUserNotificationValues = [currentUserId, friendUserId, 'friend_request', 'You are now friends with ' + friendUsername];
            const friendUserNotificationQuery = 'INSERT INTO notifications (userid, senderid, type, message) VALUES (?, ?, ?, ?)';
            const friendUserNotificationValues = [friendUserId, currentUserId, 'friend_request', currentUser + ' is now following you'];
            connection.query(currentUserNotificationQuery, currentUserNotificationValues, function (notificationError) {
              if (notificationError) {
                console.error('Error inserting notification into MySQL database: ', notificationError);
                res.status(500).send('Internal server error');
              } else {
                connection.query(friendUserNotificationQuery, friendUserNotificationValues, function (notificationError) {
                  if (notificationError) {
                    console.error('Error inserting notification into MySQL database: ', notificationError);
                    res.status(500).send('Internal server error');
                  } else {
                    res.redirect('/search');
                  }
                });
              }
            });
          }
        });
      });
    });
  });
  
  
  

  
  app.get('/notification', requireLogin, function (req, res) {
    const username = req.session.username;
  
    const s1 = 'SELECT userid FROM users WHERE username = ?';
    connection.query(s1, [username], (err, userId) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
  
      const user_id = userId[0].userid; // Extract the user ID from the query result
  
      const sql = `
      
         SELECT notifications.notificationid, notifications.type, notifications.message,
             users.username, notifications.created_at, profile_photos.filename
         FROM notifications
        INNER JOIN users ON notifications.userid = users.userid
        LEFT JOIN profile_photos ON notifications.senderid = profile_photos.userid
        WHERE notifications.userid = ?
        ORDER BY notifications.created_at DESC
        LIMIT 10
    
    
      `;
      connection.query(sql, [user_id], (err, results) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          res.status(500).send('Internal server error');
          return;
        }
  
        let notificationsHTML = '';
        if (results.length === 0) {
          notificationsHTML = '<p>No new notifications.</p>';
        } else {
          for (const notification of results) {
            const notificationType = notification.type;
            const notificationMessage = notification.message;
            const senderUsername = notification.username;
            const createdAt = notification.created_at;
            const profilephoto = notification.filename ? `/${notification.filename}` : '/default.jpg';

            notificationsHTML += `
              <article>
                <header>
                  <h2>${notificationType}</h2>
                  <p class="timestamp">${createdAt}</p>
                </header>
                <p class="notification-content">
                <div class="profile">
              <div class="profile-photo">
                <img src="/uploads${profilephoto}" alt="Image 3" class="circular-image">
              </div>
                <div class="sender"> <strong>${senderUsername} : </strong> ${notificationMessage}</div>
                </div>
                </p>
              </article>
            `;
          }
        }
  
        res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Notifications</title>
            <link rel="stylesheet" href="notifications.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
          </head>
          <body>
        
              <!-- <h1>Notifications</h1> -->
            
           
              <div class="sidebar">
                <div class="image-container">
                  <img class="image.logo" src="./Images/logo1.png" alt="Logo">
                </div>
                <a href="/feed"><i class="fas fa-home"></i> Home</a>
              <a href="/people"><i class="fas fa-users"></i> People</a>
              <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
              <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
              <a href="/search"><i class="fas fa-search"></i> Search</a>
              <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
              <a href="/profile"><i class="fas fa-user"></i> Profile</a>
              </div>
              <main>
                ${notificationsHTML}
              </main>
            </body>
          </html>
        `);
      });
    });
  });
  
  
  
  
  

  
  app.get('/people',  requireLogin, function(req, res) {
    const username = req.session.username;
  
    const getUserIDQuery = 'SELECT userid FROM users WHERE username = ?';
    connection.query(getUserIDQuery, [username], (err, userIDs) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        return res.status(500).send('Internal server error');
      }
  
      if (userIDs.length === 0) {
        // Handle case when no user with the given username is found
        return res.status(404).send('User not found');
      }
  
      const userID = userIDs[0].userid;
  
      const getUserInterestsQuery = 'SELECT interest1, interest2, interest3, interest4, interest5 FROM interests WHERE userid = ?';
      connection.query(getUserInterestsQuery, [userID], (err, interests) => {
        if (err) {
          console.error('Error fetching user interests from MySQL database: ', err);
          return res.status(500).send('Internal server error');
        }
  
        const userInterestSet = new Set();
  
        // Collect user interests into a Set, skipping NULL values
        for (let i = 0; i < interests.length; i++) {
          const currentInterest = interests[i];
          for (let j = 1; j <= 5; j++) {
            const interest = currentInterest[`interest${j}`];
            if (interest !== null) {
              userInterestSet.add(interest);
            }
          }
        }
  
        const findSimilarUsersQuery = `
        
        SELECT u.username, p.name, u.userid, profile_photos.filename
        FROM interests i
        JOIN users u ON u.userid = i.userid
        JOIN profile p ON p.userid = i.userid
        LEFT JOIN profile_photos ON i.userid = profile_photos.userid
        WHERE (i.interest1 IN (?) 
          OR i.interest2 IN (?) 
          OR i.interest3 IN (?) 
          OR i.interest4 IN (?) 
          OR i.interest5 IN (?))
          AND u.userid != ?
          AND u.userid NOT IN (
            SELECT frienduserid FROM friends WHERE userid = ?
          )
        LIMIT 20
      
      
        `;
  
        const userInterests = Array.from(userInterestSet);
  
        connection.query(findSimilarUsersQuery, [userInterests, userInterests, userInterests, userInterests, userInterests, userID, userID], (err, results) => {
          if (err) {
            console.error('Error fetching similar interests from MySQL database: ', err);
            return res.status(500).send('Internal server error');
          }
  
          const response = results.map((result) => {
            const { username, name, userid, filename } = result;
            const profilephoto = filename ? `/${filename}` : '/default.jpg';

            return `
            <div class="card">
            <div class="profile-photo">
              <img src="/uploads${profilephoto}" alt="Image 2">
            </div>
               <div  class="context">
                <a href="/friendprofile/${userid}"><h2>${username}</h2></a> 
                <p>${name}</p>
                <form method="POST" action="/connect">
                  <input type="hidden" name="friendUsername" value="${username}">
                  <button type="submit">Follow</button>
                </form>
              </div>
              </div>
            `;
          }).join('');
  
          res.send(`
          <html>
          <head>
            <title>Similar Interests</title>
            <link rel="stylesheet" type="text/css" href="temp.css">
            <link href='https://fonts.googleapis.com/css?family=Outfit' rel='stylesheet'>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
      
          </head>
          <body>
            <div class="sidebar">
              <div class="image-container">
                <img class="image.logo" src="./Images/logo1.png" alt="Logo">
              </div>
              <a href="/feed"><i class="fas fa-home"></i> Home</a>
              <a href="/people"><i class="fas fa-users"></i> People</a>
              <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
              <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
              <a href="/search"><i class="fas fa-search"></i> Search</a>
              <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
              <a href="/profile"><i class="fas fa-user"></i> Profile</a>
            </div>
      
            
      
            <div class="campus">
              <div class="logo-and-profile">
                <h1><b>CAMPUS CONNECT</b></h1>
                <a href="user_profile.html" class="home-icon"><i class="fas fa-home"></i></a>
              </div>
            </div>
              
            <div class="content">
               <div class="similar">
                 <h1>Connect with People who Share your Interests</h1>
                  <p>Here are some people who have similar interests</p>
              </div>
            <div class="card-container">
                  ${response}
                </div>
                </div>
                </div>
              </body>
            </html>
          `);
        });
      });
    });
  });
  
  


  app.get('/profile', requireLogin, (req, res) => {
    const username = req.session.username;
  
    const getUserIDQuery = 'SELECT userid FROM users WHERE username = ?';
    connection.query(getUserIDQuery, [username], (err, userIDs) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        return res.status(500).send('Internal server error');
      }
  
      const userid = userIDs[0]?.userid;
  
      const getDetailsQuery = `
        SELECT u.username, p.name, COUNT(friend.frienduserid) AS friendcount,
          CASE WHEN i.interest1 IS NOT NULL THEN i.interest1 ELSE '' END AS interest1,
          CASE WHEN i.interest2 IS NOT NULL THEN i.interest2 ELSE '' END AS interest2,
          CASE WHEN i.interest3 IS NOT NULL THEN i.interest3 ELSE '' END AS interest3,
          CASE WHEN i.interest4 IS NOT NULL THEN i.interest4 ELSE '' END AS interest4,
          CASE WHEN i.interest5 IS NOT NULL THEN i.interest5 ELSE '' END AS interest5,
          f.postid, f.title, f.content, f.topic, ph.filename, p.sem, p.stream, u.email, f.interests
        FROM users u
        JOIN interests i ON u.userid = i.userid
        JOIN profile p ON p.userid = u.userid
        LEFT JOIN friends friend ON friend.userid = u.userid
        LEFT JOIN posts f ON f.userid = u.userid
        LEFT JOIN profile_photos ph ON ph.userid = u.userid
        WHERE u.userid = ?
        GROUP BY u.userid, u.username, p.name, i.interest1, i.interest2, i.interest3, i.interest4, i.interest5, f.postid, f.title, f.content, f.topic, ph.filename, p.sem, p.stream, u.email, f.interests
      `;
  
      connection.query(getDetailsQuery, [userid], (err, results) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          return res.status(500).send('Internal server error');
        }
  
        const postsByUser = {};
        results.forEach((result) => {
          const {
            username,
            name,
            friendcount,
            interest1,
            interest2,
            interest3,
            interest4,
            interest5,
            postid,
            title,
            content,
            topic,
            filename,
            sem,
            stream,
            email,
            interests,
          } = result;
  
          if (!postsByUser[username]) {
            postsByUser[username] = {
              name,
              friendcount,
              interests: [interest1, interest2, interest3, interest4, interest5].filter((interest) => interest !== ''),
              posts: [],
              profilePhoto: filename ? `/${filename}` : '/default.jpg',
              sem,
              stream,
              email,
            };
          }
  
          if (postid && title && content && topic) {
            postsByUser[username].posts.push({
              postid,
              title,
              content,
              topic,
              interests,
            });
          }
        });
  
        console.log('Posts by User:', postsByUser);
  
        let profilephotoid = null;
  
        const getProfilePhotoIdQuery = 'SELECT profilephotoid FROM profile_photos WHERE userid = ?';
        connection.query(getProfilePhotoIdQuery, [userid], (err, r) => {
          if (err) {
            console.error('Error fetching data from MySQL database: ', err);
            return res.status(500).send('Internal server error');
          }
  
          console.log('Profile Photo Results:', r);
  
          profilephotoid = r.length > 0 ? r[r.length - 1].profilephotoid : null;
  
          console.log('Profile Photo ID:', profilephotoid);
  
          const generateInterestsHTML = (interests1) => {
            return interests1.map((interest) => `<li>${interest}</li>`).join('');
          };
  
          const generatePostsHTML = (posts) => {
            if (posts.length > 0) {
              return posts.map((post) => `
                <div class="post" data-postid="${post.postid}">
                  <form method="POST" action="/DELETE/${post.postid}"> 
                    <button type="submit">Delete</button>
                  </form>
                  <h3>${post.title}</h3>
                  <h5>${post.topic}</h5>
                  <p>${post.content}</p>
                  <p>${post.interests}</p>
                </div>
              `).join('');
            } else {
              return '<p>No posts yet.</p>';
            }
          };
  
          const htmlPosts = Object.keys(postsByUser).map((username) => {
            const { name, friendcount, interests, posts, profilePhoto, sem, stream, email } = postsByUser[username];
  
            const interestsHTML = generateInterestsHTML(interests);
            const postsHTML = generatePostsHTML(posts);
  
            const profilePhotoPath = profilePhoto.replace(/\\/g, '/');
  
            console.log('Profile Photo Path:', profilePhotoPath);
  
            return `
              <div class="profile">
                <h2>@${username}</h2>
                <h3>${name}</h3>
                <div class="profile-photo-container">
                  <img src="uploads${profilePhotoPath}" alt="Profile Photo">
                </div>
                <div class="Details"> 
                  <p><b>Friends:</b> ${friendcount}</p>
                  <p><b>Semester:</b> ${sem}</p>
                  <p><b>Stream:</b> ${stream}</p>
                  <p><b>Email Id:</b> ${email}</p>
                </div>
                <h3>Interests:</h3>
                <ul id="interests">
                  ${interestsHTML}
                  <form method="GET" action="/editint">
                    <button type="submit">Edit</button>
                  </form>
                </ul>
              </div>
              <h2>All Posts:</h2>
              ${postsHTML}
            `;
          });
  
          console.log('HTML Posts:', htmlPosts);
  
          res.send(`
            <html>
              <head>
                <title>Profile</title>
                <link rel="stylesheet" type="text/css" href="profile.css">
                <style>
                  .profile-photo-container {
                    width: 150px;
                    height: 150px;
                    overflow: hidden;
                  }
                  .profile-photo-container img {
                    object-fit: cover;
                    width: 100%;
                    height: 100%;
                  }
                </style>
              </head>
              <body>
              
              <div class="sidebar">
                <div class="image-container">
                  <img class="image.logo" src="./Images/logo1.png" alt="Logo">
                </div>
                <a href="/feed"><i class="fas fa-home"></i> Home</a>
                <a href="/people"><i class="fas fa-users"></i> People</a>
                <a href="/post"><i class="fas fa-pencil-alt"></i> Post</a>
                <a href="/chat"><i class="fas fa-comments"></i> Chats</a>
                <a href="/search"><i class="fas fa-search"></i> Search</a>
                <a href="/notification"><i class="fas fa-bell"></i> Notifications</a>
                <a href="/profile"><i class="fas fa-user"></i> Profile</a>
                <form method="POST" action="/logout">
                      <button type="submit">LOGOUT</button>
                    </form>
              </div>
              ${htmlPosts.join('')}
            </body>
          </html>
        `);
      });
    });
  });
});

  
  
  

  

  
  
  


    // GET request to render the editint.html form
app.get('/editint', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editint', 'editint.html'));
});

// POST request to handle updating user interests
app.post('/editint', function (req, res) {
  const interests = req.body.interest;
  console.log('Received interests:', interests); // Debug: Check if interests are received correctly

  // Some code to fetch the user ID based on the session username
  const username = req.session.username;
  const getUserIDQuery = 'SELECT userid FROM users WHERE username = ?';
  connection.query(getUserIDQuery, [username], (err, userIDs) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }

    if (!Array.isArray(interests)) {
      interests = [interests];
    }

    if (!interests) {
      res.status(400).send('Bad request');
      return;
    }

    const userid = userIDs[0]?.userid;

    // Update the interests in the database
    const updateInterestsQuery = 'UPDATE interests SET interest1 = ?, interest2 = ?, interest3 = ?, interest4 = ?, interest5 = ? WHERE userid = ?';
    const interestValues = interests.slice(0, 5); // Considering up to 5 interests
    while (interestValues.length < 5) {
      interestValues.push(null); // Fill remaining columns with null if fewer than 5 interests are provided
    }

    connection.query(updateInterestsQuery, [...interestValues, userid], (err, result) => {
      if (err) {
        console.error('Error updating data in MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }

      console.log('Interests updated successfully:', result); // Debug: Check the result of the update

      // Update the session information with the new interests
      req.session.info = true;
      req.session.interest = interests;

      // Redirect the user back to the profile page
      res.redirect('/profile');
    });
  });
});

    app.post('/DELETE/:postId', requireLogin, (req, res) => {
      const postId = req.params.postId; // Get the postId from the URL parameter
    
      if (!postId) {
        return res.status(400).send('Post ID is missing in the request.');
      }
    
      // Check if the user is authorized to delete the post (e.g., the user owns the post)
      const username = req.session.username;
      const getPostOwnerQuery = 'SELECT userid FROM posts WHERE postid = ?';
      connection.query(getPostOwnerQuery, [postId], (err, results) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          return res.status(500).send('Internal server error');
        }
    
        const postOwnerUserId = results[0]?.userid;
    
        // Check if the post exists and if the user is authorized to delete it
       
    
        // Delete the associated likes from the likes table
        const deleteLikesQuery = 'DELETE FROM likes WHERE postid = ?';
        connection.query(deleteLikesQuery, [postId], (err, deleteLikesResult) => {
          if (err) {
            console.error('Error deleting likes from MySQL database: ', err);
            return res.status(500).send('Internal server error');
          }
    
          // Now that the associated likes have been deleted, proceed with deleting the post
          const deletePostQuery = 'DELETE FROM posts WHERE postid = ?';
          connection.query(deletePostQuery, [postId], (err, deletePostResult) => {
            if (err) {
              console.error('Error deleting post from MySQL database: ', err);
              return res.status(500).send('Internal server error');
            }
    
            // Check if the post was successfully deleted
            if (deletePostResult.affectedRows === 0) {
              return res.status(404).send('Post not found.');
            }
    
            // Successful deletion
            console.log('Post deleted successfully:', postId);
            res.redirect('/profile');
          });
        });
      });
    });
    
    
    
    
    
  
  
  app.post('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session: ', err);
        return res.status(500).send('Internal server error');
      }
      
      // Redirect to the '/' page
      res.redirect('/');
    });
  });
  













  app.post('/connect', (req, res) => {
    const currentUser = req.session.username;
    const friendUser = req.body.friendUsername;
  
    // Retrieve the user IDs for the current user and friend user
    const getUserIDQuery = 'SELECT userid FROM users WHERE username = ?';
    const insertFriendQuery = 'INSERT INTO friends (userid, frienduserid) VALUES (?, ?)';
    const insertNotificationQuery = 'INSERT INTO notifications (userid, senderid, type, message, created_at) VALUES (?, ?, ?, ?, ?)';
  
    connection.query(getUserIDQuery, [currentUser], (err, currentUserIds) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
      if (currentUserIds.length === 0) {
        // Handle case when no user with the current username is found
        return res.status(404).send('Current user not found');
      }
      const currentUserId = currentUserIds[0].userid;
  
      connection.query(getUserIDQuery, [friendUser], (err, friendUserIds) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          res.status(500).send('Internal server error');
          return;
        }
        if (friendUserIds.length === 0) {
          // Handle case when no user with the friend username is found
          return res.status(404).send('Friend user not found');
        }
        const friendUserId = friendUserIds[0].userid;
  
        // Insert a new row into the friends table
        connection.query(insertFriendQuery, [currentUserId, friendUserId], (error, results) => {
          if (error) {
            console.error('Error inserting data into MySQL database: ', error);
            res.status(500).send('Internal server error');
            return;
          }
  
          // Create a notification for the current user
          const currentNotificationValues = [currentUserId, friendUserId, 'friend_request', `You are now friends with ${friendUser}`, new Date()];
          connection.query(insertNotificationQuery, currentNotificationValues, (notificationError) => {
            if (notificationError) {
              console.error('Error inserting notification into MySQL database: ', notificationError);
              res.status(500).send('Internal server error');
              return;
            }
  
            // Create a notification for the friend user
            const friendNotificationValues = [friendUserId, currentUserId, 'friend_request', `${currentUser} have followed you`, new Date()];
            connection.query(insertNotificationQuery, friendNotificationValues, (notificationError) => {
              if (notificationError) {
                console.error('Error inserting notification into MySQL database: ', notificationError);
                res.status(500).send('Internal server error');
                return;
              }
  
              res.redirect('/people');
            });
          });
        });
      });
    });
  });
   







app.get('/post', requireLogin, function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'post', 'post.html'));
    
});





app.post('/post', function (req, res) {
    const { title, content, topic, interest } = req.body;
    const username = req.session.username;
  
    const sql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(sql, [username], (err, userids) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
  
      const userid = userids[0].userid;
  
      if (title && content && topic && interest) {
        const insertPostQuery = 'INSERT INTO posts (userid, title, content, topic, interests) VALUES (?, ?, ?, ?, ?)';
        connection.query(insertPostQuery, [userid, title, content, topic, interest], (err5, result) => {
          if (err5) {
            console.error('Error inserting data into MySQL database: ', err5);
            res.status(500).send('Internal server error');
            return;
          }
  
          res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Post Submitted</title>
                <link rel="stylesheet" href="post.css">
              </head>
              <body>
                <header>
                  <h1>Post Submitted</h1>
                </header>
                <main>
                  <p>Thank you for submitting your post!</p>
                  <p>Title: ${title}</p>
                  <p>Content: ${content}</p>
                  <p>Topic: ${topic}</p>
                  <p>Interest: ${interest}</p>
                </main>
              </body>
            </html>
          `);
        });
      } else {
        res.status(400).send('Missing required fields');
      }
    });
  });


app.get('/info', (req, res) => {
    
    if(!req.session.loggedin){
      res.redirect('/signup');
    }else{
      res.sendFile(path.join(__dirname , 'public' , 'details' , 'details.html'));
    }
  });
 
app.post('/info', function (req, res) {
    const { full, phone, dateo, course, semester, sex, ending  } = req.body;
    const username = req.session.username;
    
    const sql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(sql, [username], (err, userids) => {
        if (full && dateo && phone && course && semester && ending && sex ) {
            const sql2 = 'INSERT INTO profile (userid, name, phone, dob, gender, stream, sem, yoa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            const userid = userids[0].userid;
            connection.query(sql2, [userid, full, phone, dateo, sex, course, semester, ending], (err, result) => {
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
      res.sendFile(path.join(__dirname , 'public' , 'accomadation' , 'acco.html'));
    }
  });
  
  app.post('/moreinfo', function (req, res) {
    const { country, state, accomadation, hostel } = req.body;
    console.log("country:", country);
    console.log("state:", state);
    console.log("accommodation:", accomadation);
    console.log("hostel:", hostel);
    const username = req.session.username;
    console.log("username:", username);
    const sql = 'SELECT userid FROM users WHERE username = ?';
    console.log("sql:", sql);
    connection.query(sql, [username], (err, userids) => {
        if (country && accomadation ) {
            const sql2 = 'INSERT INTO info (country, state, accommodation, hostel, userid) VALUES (?, ?, ?, ?, ?)';
            const userid = userids[0].userid;
            console.log("userid:", userid);
            connection.query(sql2, [country, state, accomadation, hostel, userid], (err, result) => {
                if (err) {
                    console.log(err);
                    res.redirect('/moreinfo');
                } else {
                    console.log(result);
                    res.redirect('/profilephoto');
                }
            });
        } else {
            console.log("Fields not complete!");
            res.redirect('/moreinfo');
        }
    });  
});

const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const username = req.session.username; // Assuming username is stored in the session
    const filename = username + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop();
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });


app.get('/profilephoto', (req, res) => {
  if (!req.session.info) {
    console.log('User session not found. Redirecting to /signup');
    res.redirect('/signup');
  } else {
    console.log('User session found. Serving profilephoto.html');
    res.sendFile(path.join(__dirname, 'public', 'ProfilePicture', 'pfp.html'));
  }
});

app.post('/profilephoto', upload.single('profilePhoto'), (req, res) => {
  const file = req.file;

  if (!file) {
    console.log('No file uploaded');
    res.status(400).send('No file uploaded.');
    return;
  }

  console.log('File uploaded:', file);


  const username = req.session.username;
  const getUserIdQuery = 'SELECT userid FROM users WHERE username = ?';
  connection.query(getUserIdQuery, [username], (err, userids) => {
    if (err) {
      console.error('Error fetching user ID from database:', err);
      res.status(500).send('Error fetching user ID from database.');
      return;
    }

    const userid = userids[0].userid;

    const { filename, path, mimetype } = file;
    const insertPhotoQuery = 'INSERT INTO profile_photos (userid, filename, path, mimetype) VALUES (?, ?, ?, ?)';
    connection.query(insertPhotoQuery, [userid, filename, path, mimetype], (err, result) => {
      if (err) {
        console.error('Error storing file in database:', err);
        res.status(500).send('Error storing file in database.');
      } else {
        console.log(result);
        res.redirect('/int');
      }
    });
  });
});





app.get('/int', (req, res) => {
  if (!req.session.info) {
    res.redirect('/signup');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'int', 'int.html'));
  }
});


app.post('/int', function (req, res) {
  let interests = req.body.interest;
  const username = req.session.username;
  const sql = 'SELECT userid FROM users WHERE username = ?';
  connection.query(sql, [username], (err, userids) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }
    if (!Array.isArray(interests)) {
      interests = [interests];
    }
    if (!interests) {
      res.status(400).send('Bad request');
      return;
    }
    const sql2 = 'INSERT INTO interests (userid, interest1, interest2, interest3, interest4, interest5) VALUES (?, ?, ?, ?, ?, ?)';
    const userid = userids[0].userid;
    const interestValues = interests.slice(0, 5); // Considering up to 5 interests
    while (interestValues.length < 5) {
      interestValues.push(null); // Fill remaining columns with null if fewer than 5 interests are provided
    }
    connection.query(sql2, [userid, ...interestValues], (err, result) => {
      if (err) {
        console.error('Error inserting data into MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
      console.log(result);
      req.session.info = true;
      req.session.interest = interests;
      res.redirect('/similar');
    });
  });  
});







app.get('/similar', (req, res) => {
  const username = req.session.username;

  const getUserIDQuery = 'SELECT userid FROM users WHERE username = ?';
  connection.query(getUserIDQuery, [username], (err, userIDs) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      return res.status(500).send('Internal server error');
    }

    const userID = userIDs[0]?.userid;

    const getUserInterestsQuery = 'SELECT interest1, interest2, interest3, interest4, interest5 FROM interests WHERE userid = ?';
    connection.query(getUserInterestsQuery, [userID], (err, interests) => {
      if (err) {
        console.error('Error fetching user interests from MySQL database: ', err);
        return res.status(500).send('Internal server error');
      }

      const userInterestSet = new Set();

      // Collect user interests into a Set, skipping NULL values
      for (let i = 0; i < interests.length; i++) {
        const currentInterest = interests[i];
        for (let j = 1; j <= 5; j++) {
          const interest = currentInterest[`interest${j}`];
          if (interest !== null) {
            userInterestSet.add(interest);
          }
        }
      }

      const findSimilarUsersQuery = `
        SELECT u.username, p.name, profile_photos.filename
        FROM interests i
        JOIN users u ON u.userid = i.userid
        JOIN profile p ON p.userid = i.userid
        LEFT JOIN profile_photos ON i.userid = profile_photos.userid
        WHERE (i.interest1 IN (?) 
          OR i.interest2 IN (?) 
          OR i.interest3 IN (?) 
          OR i.interest4 IN (?) 
          OR i.interest5 IN (?))
          AND u.userid != ?
          AND u.userid NOT IN (
            SELECT frienduserid FROM friends WHERE userid = ?
          )
          LIMIT 20
      `;

      const userInterests = Array.from(userInterestSet);

      connection.query(findSimilarUsersQuery, [userInterests, userInterests, userInterests, userInterests, userInterests, userID, userID], (err, results) => {
        if (err) {
          console.error('Error fetching similar interests from MySQL database: ', err);
          return res.status(500).send('Internal server error');
        }

        const response = results.map((result) => {
          const { username, name, filename } = result;
          const profilephoto = filename ? `/${filename}` : '/default.jpg';

          return `
          <div class="card">
          <div class="profile-photo">
            <img src="/uploads${profilephoto}" alt="Image 2">
          </div>
             <div  class="context">
              <h2>${username}</h2> 
              <p>${name}</p>
              <form method="POST" action="/follow">
                <input type="hidden" name="friendUsername" value="${username}">
                <button type="submit">Follow</button>
              </form>
            </div>
            </div>
          `;
        }).join('');

        res.send(`
        <html>
          <head>
           <title>Similar Interests</title>
            <link rel="stylesheet" type="text/css" href="temp.css">
            <link href='https://fonts.googleapis.com/css?family=Outfit' rel='stylesheet'>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    
          </head>
            <body>
            <div class="content">
            <div class="similar">
              <h1>Connect with People who Share your Interests</h1>
               <p>Here are some people who have similar interests</p>
            </div>
            <div class="card-container">
               ${response}
             </div>
             </div>
              <a href="/feed">Home</a>
            </body>
          </html>
        `);
      });
    });
  });
});

app.post('/follow', (req, res) => {
  const currentUser = req.session.username;
  const friendUser = req.body.friendUsername;

  // Retrieve the user IDs for the current user and friend user
  const getUserIDQuery = 'SELECT userid FROM users WHERE username = ?';
  const insertFriendQuery = 'INSERT INTO friends (userid, frienduserid) VALUES (?, ?)';
  const insertNotificationQuery = 'INSERT INTO notifications (userid, senderid, type, message, created_at) VALUES (?, ?, ?, ?, ?)';

  connection.query(getUserIDQuery, [currentUser], (err, currentUserIds) => {
    if (err) {
      console.error('Error fetching data from MySQL database: ', err);
      res.status(500).send('Internal server error');
      return;
    }
    if (currentUserIds.length === 0) {
      // Handle case when no user with the current username is found
      return res.status(404).send('Current user not found');
    }
    const currentUserId = currentUserIds[0].userid;

    connection.query(getUserIDQuery, [friendUser], (err, friendUserIds) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
      if (friendUserIds.length === 0) {
        // Handle case when no user with the friend username is found
        return res.status(404).send('Friend user not found');
      }
      const friendUserId = friendUserIds[0].userid;

      // Insert a new row into the friends table
      connection.query(insertFriendQuery, [currentUserId, friendUserId], (error, results) => {
        if (error) {
          console.error('Error inserting data into MySQL database: ', error);
          res.status(500).send('Internal server error');
          return;
        }

        // Create a notification for the current user
        const currentNotificationValues = [currentUserId, friendUserId, 'friend_request', `You are now friends with ${friendUser}`, new Date()];
        connection.query(insertNotificationQuery, currentNotificationValues, (notificationError) => {
          if (notificationError) {
            console.error('Error inserting notification into MySQL database: ', notificationError);
            res.status(500).send('Internal server error');
            return;
          }

          // Create a notification for the friend user
          const friendNotificationValues = [friendUserId, currentUserId, 'friend_request', `${currentUser} is following you`, new Date()];
          connection.query(insertNotificationQuery, friendNotificationValues, (notificationError) => {
            if (notificationError) {
              console.error('Error inserting notification into MySQL database: ', notificationError);
              res.status(500).send('Internal server error');
              return;
            }

            res.redirect('/similar');
          });
        });
      });
    });
  });
});


const port = 5000;

app.listen(port, function () {
  console.log(`Server started on port ${port}`);
});