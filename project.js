const express = require('express');
const mysql = require('mysql');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { error } = require('console');

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
  

  
  

  
  
  

  app.get('/feed', function (req, res) {
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
          SELECT posts.postid, posts.title, posts.content, posts.topic, users.username, COUNT(likes.likeid) AS likeCount
          FROM posts
          INNER JOIN users ON posts.userid = users.userid
          LEFT JOIN likes ON posts.postid = likes.postid
          WHERE posts.userid IN (${placeholders})
          GROUP BY posts.postid, posts.title, posts.content, posts.topic, users.username
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
                  <button type="submit">${post.likeCount > 0 ? 'Unlike' : 'Like'}</button>
                </form>
              `;
  
              postsHTML += `
                <article>
                  <header>

                    <h2>${post.title}</h2>
                    <p class="account-name">${post.username}</p>
                  </header>
                  <p class="post-content">${post.content}</p>
                  <p class="likes-count">Likes: ${post.likeCount}</p>
                  ${likeButton}
                </article>
              `;
            }
          }
  
          res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>My Feed</title>
                <link rel="stylesheet" href="feed.css">
              </head>
              <body>
                <header>
                  <h1>My Feed</h1>
                </header>
                <nav>
                  <ul>
                  <li><a href="/feed">Home</a></li>
                  <li><a href="/post">Post</a></li>
                  <li><a href="/search">Search</a></li>
                  <li><a href="/notification">Notification</a></li>
                  <li><a href="/people">People</a></li>
                  <li><a href="/profile">Profile</a></li>
                  </ul>
                </nav>
                <main>
                  ${postsHTML}
                </main>
              </body>
            </html>
          `);
        });
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

  
  
  

  
  app.get('/search', function (req, res) {
    const searchedUsername = req.query.username; // Assuming the search input is passed as a query parameter with the name 'username'
  
    // Retrieve the current user ID
    const currentUser = req.session.username;
    const currentUserSql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(currentUserSql, [currentUser], (err, currentUserIds) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
  
      const currentUserId = currentUserIds[0].userid;
  
      // Search for users with similar usernames
      const sql =
        'SELECT u.userid, u.username, p.name FROM users u INNER JOIN profile p ON u.userid = p.userid WHERE u.username LIKE ?';
      connection.query(sql, [searchedUsername + '%'], (err, results) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          res.status(500).send('Internal server error');
          return;
        }
  
        let searchResultsHTML = '';
        if (results.length === 0) {
          searchResultsHTML = '<p>No results found.</p>';
        } else {
          const friendUserIds = results.map((result) => result.userid);
  
          // Check if the current user is following each user in the search results
          const isFollowingSql = 'SELECT frienduserid FROM friends WHERE userid = ? AND frienduserid IN (?)';
          connection.query(isFollowingSql, [currentUserId, friendUserIds], (err, followingResults) => {
            if (err) {
              console.error('Error fetching data from MySQL database: ', err);
              res.status(500).send('Internal server error');
              return;
            }
  
            const followingUserIds = followingResults.map((result) => result.frienduserid);
  
            for (const result of results) {
              const isFollowingUser = followingUserIds.includes(result.userid);
              const isCurrentUser = result.userid === currentUserId;
              
              searchResultsHTML += `
                <article>
                  <header>
                    <h2>@${result.username}</h2>
                    <p>${result.name}</p>
                  </header>
    
                  <form method="POST" action="/befri">
                    <input type="hidden" name="friendUsername" value="${result.username}">
                    ${
                      isCurrentUser
                        ? '<button type="button" class="follow-button">You</button>'
                        : isFollowingUser
                        ? '<button type="button" class="follow-button">Following</button>'
                        : '<button type="submit" class="follow-button">Follow</button>'
                    }
                  </form>
                </article>
              `;
            }
  
            sendSearchResultsHTML();
          });
        }
  
        function sendSearchResultsHTML() {
          res.send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>User Search</title>
                <link rel="stylesheet" href="search.css">
              </head>
              <body>
                <header>
                  <h1>User Search</h1>
                </header>
                <nav>
                  <ul>
                  <li><a href="/feed">Home</a></li>
                  <li><a href="/post">Post</a></li>
                  <li><a href="/search">Search</a></li>
                  <li><a href="/notification">Notification</a></li>
                  <li><a href="/people">People</a></li>
                  <li><a href="/profile">Profile</a></li>
                  </ul>
                </nav>
                <main>
                  <form action="/search" method="GET">
                    <input type="text" name="username" placeholder="Enter @username" />
                    <button type="submit">Search</button>
                  </form>
                  ${searchResultsHTML}
                </main>
              </body>
            </html>
          `);
        }
  
        // If no search results, send the response immediately
        if (results.length === 0) {
          sendSearchResultsHTML();
        }
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
  
  
  

  
  app.get('/notification', function (req, res) {
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
             users.username, notifications.created_at
         FROM notifications
        INNER JOIN users ON notifications.userid = users.userid
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
  
            notificationsHTML += `
              <article>
                <header>
                  <h2>${notificationType}</h2>
                  <p class="timestamp">${createdAt}</p>
                </header>
                <p class="notification-content">
                  <strong>${senderUsername}</strong> ${notificationMessage}
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
              <link rel="stylesheet" href="/notification.css">
            </head>
            <body>
              <header>
                <h1>Notifications</h1>
              </header>
              <nav>
                <ul>
                  <li><a href="/feed">Home</a></li>
                  <li><a href="/post">Post</a></li>
                  <li><a href="/search">Search</a></li>
                  <li class="active"><a href="/notification">Notification</a></li>
                  <li><a href="/people">People</a></li>
                  <li><a href="/profile">Profile</a></li>
                </ul>
              </nav>
              <main>
                ${notificationsHTML}
              </main>
            </body>
          </html>
        `);
      });
    });
  });
  
  
  
  
  

  
  app.get('/people', function(req, res) {
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
        
        SELECT u.username, p.name
        FROM interests i
        JOIN users u ON u.userid = i.userid
        JOIN profile p ON p.userid = i.userid
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
            const { username, name } = result;
            return `
              <li>
                <h2>@${username}</h2>
                <p>${name}</p>
                <form method="POST" action="/connect">
                  <input type="hidden" name="friendUsername" value="${username}">
                  <button type="submit">Follow</button>
                </form>
              </li>
            `;
          }).join('');
  
          res.send(`
            <html>
              <head>
                <title>Similar Interests</title>
                <link rel="stylesheet" type="text/css" href="similar.css">
              </head>
              <body>
              <nav>
                  <ul>
                  <li><a href="/feed">Home</a></li>
                  <li><a href="/post">Post</a></li>
                  <li><a href="/search">Search</a></li>
                  <li><a href="/notification">Notification</a></li>
                  <li><a href="/people">People</a></li>
                  <li><a href="/profile">Profile</a></li>
                  </ul>
                </nav>
                <h1>Connect with People who Share your Interests</h1>
                <p>Here are some people who have similar interests</p>
                <ul>
                  ${response}
                </ul>
                
              </body>
            </html>
          `);
        });
      });
    });
  });
    const util = require('util');
    const queryPromise = util.promisify(connection.query).bind(connection);
  


  app.get('/profile', (req, res) => {
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
          f.title, f.content, f.topic
        FROM users u
        JOIN interests i ON u.userid = i.userid
        JOIN profile p ON p.userid = u.userid
        LEFT JOIN friends friend ON friend.userid = u.userid
        LEFT JOIN posts f ON f.userid = u.userid
        WHERE u.userid = ?
        GROUP BY u.userid, u.username, p.name, i.interest1, i.interest2, i.interest3, i.interest4, i.interest5, f.title, f.content, f.topic
      `;
  
      connection.query(getDetailsQuery, [userid], (err, results) => {
        if (err) {
          console.error('Error fetching data from MySQL database: ', err);
          return res.status(500).send('Internal server error');
        }
  
        // Group posts by user
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
            title,
            content,
            topic,
          } = result;
  
          if (!postsByUser[username]) {
            postsByUser[username] = {
              name,
              friendcount,
              interests: [interest1, interest2, interest3, interest4, interest5].filter((interest) => interest !== ''),
              posts: [],
            };
          }
  
          if (title && content && topic) {
            postsByUser[username].posts.push({
              title,
              content,
              topic,
            });
          }
        });
  
        const htmlPosts = Object.keys(postsByUser).map((username) => {
          const { name, friendcount, interests, posts } = postsByUser[username];
  
          // Generate HTML for interests
          const interestsHTML = interests.map((interest) => `<li>${interest}</li>`).join('');
  
          // Generate HTML for each post
          let postsHTML = '';
          if (posts.length > 0) {
            postsHTML = posts
              .map(
                (post) => `
                  <div class="post">
                    <h3>${post.title}</h3>
                    <h5>${post.topic}</h5>
                    <p>${post.content}</p>
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
              <h3>Interests:</h3>
              <ul id="interests">
                ${interestsHTML}
              </ul>
            </div>
            <h2>All Posts:</h2>
            ${postsHTML}
          `;
        });
  
        res.send(`
          <html>
            <head>
              <title>Profile</title>
              <link rel="stylesheet" type="text/css" href="profile.css">
            </head>
            <body>
            <nav>
                  <ul>
                  <li><a href="/feed">Home</a></li>
                  <li><a href="/post">Post</a></li>
                  <li><a href="/search">Search</a></li>
                  <li><a href="/notification">Notification</a></li>
                  <li><a href="/people">People</a></li>
                  <li><a href="/profile">Profile</a></li>
                  </ul>
                </nav>
              ${htmlPosts.join('')}
            </body>
          </html>
        `);
      });
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
  
  

  // Express route handler
app.get('/post', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'post.html'));
    
});



app.post('/post', function (req, res) {
    const { title, content, topic } = req.body;
    const username = req.session.username;
  
    const sql = 'SELECT userid FROM users WHERE username = ?';
    connection.query(sql, [username], (err, userids) => {
      if (err) {
        console.error('Error fetching data from MySQL database: ', err);
        res.status(500).send('Internal server error');
        return;
      }
  
      const userid = userids[0].userid;
  
      if (title && content && topic) {
        const insertPostQuery = 'INSERT INTO posts (userid, title, content, topic) VALUES (?, ?, ?, ?)';
        connection.query(insertPostQuery, [userid, title, content, topic], (err5, result) => {
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
  if (!req.session.info) {
    res.redirect('/signup');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'int.html'));
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
        SELECT u.username, p.name
        FROM interests i
        JOIN users u ON u.userid = i.userid
        JOIN profile p ON p.userid = i.userid
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
          const { username, name } = result;
          return `
            <li>
              <h2>@${username}</h2>
              <p>${name}</p>
              <form method="POST" action="/follow">
                <input type="hidden" name="friendUsername" value="${username}">
                <button type="submit">Follow</button>
              </form>
            </li>
          `;
        }).join('');

        res.send(`
          <html>
            <head>
              <title>Similar Interests</title>
              <link rel="stylesheet" type="text/css" href="similar.css">
            </head>
            <body>
              <h1>Connect with People who Share your Interests</h1>
              <p>Here are some people who have similar interests</p>
              <ul>
                ${response}
              </ul>
              <a href="/">Home</a>
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