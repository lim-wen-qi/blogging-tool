const express = require("express");
const router = express.Router();

// Reader login page
router.get("/login", function(req, res){
    res.render("reader/login.ejs");
});

// Reader login handler
router.post("/login", function(req, res, next) {
    const { identifier, password } = req.body;
    const query = "SELECT * FROM users WHERE (user_name = ? OR email_address = ?) AND role = 'reader'";
    const query_parameters = [identifier, identifier];

    global.db.get(query, query_parameters, function(err, user) {
        if (err) {
            return next(err);
        } else if (user && user.password === password) {
            req.session.user = { user_id: user.user_id, role: user.role, username: user.user_name };
            console.log('User session after login:', req.session.user);
            res.redirect("/reader/home");
        } else {
            res.status(401).send(`Invalid username, email, or password. 
                <form action="/reader/login" method="get">
                    <button type="submit">Try again</button>
                </form>
                No account?
                <form action="/users/register" method="get">
                    <button type="submit">Register Here</button>
                </form>`);
        }
    });
});

// Middleware to check if user is a reader
router.use(function(req, res, next) {
    console.log('User session in middleware:', req.session.user);
    if (req.session.user && req.session.user.role === 'reader') {
        res.locals.user = req.session.user;
        next();
    } else {
        res.status(403).send('Access denied');
    }
});

// Reader home route
router.get("/home", function(req, res, next) {
    const query = `
        SELECT b.blog_id, b.blog_name, b.author_name, a.article_id, a.title, a.content, a.created_at, a.last_modified, a.reads, a.likes
        FROM blogs b
        LEFT JOIN articles a ON b.blog_id = a.blog_id
        WHERE a.state = 'published'
        ORDER BY b.blog_id, a.created_at DESC;
    `;

    global.db.all(query, function(err, results) {
        if (err) {
            return next(err);
        }

        // Organize data into blogs with their articles
        const blogs = [];
        let currentBlog = null;
        results.forEach(function(row) {
            if (!currentBlog || currentBlog.blog_id !== row.blog_id) {
                // New blog encountered
                currentBlog = {
                    blog_id: row.blog_id,
                    blog_name: row.blog_name,
                    author_name: row.author_name,
                    articles: []
                };
                blogs.push(currentBlog);
            }
            // Add article to current blog's articles
            currentBlog.articles.push({
                article_id: row.article_id,
                title: row.title,
                content: row.content,
                created_at: row.created_at,
                last_modified: row.last_modified,
                reads: row.reads,
                likes: row.likes
            });
        });

        // Fetch current user information and set to res.locals.user
        const currentUser = req.session.user;
        res.locals.user = currentUser;

        // Render the reader-home.ejs template with fetched data and current user
        res.render("reader/home.ejs", {
            username: (currentUser && currentUser.username) ? currentUser.username : null,
            blogs: blogs
        });
    });
});

router.get("/article/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const userId = req.session.user.user_id; // Assuming user is authenticated and session is set
    const currentUser = req.session.user;

    global.db.serialize(function() {
        // Fetch the article details including author_name from the database
        global.db.get("SELECT articles.*, users.user_name AS author_name FROM articles JOIN users ON articles.author_id = users.user_id WHERE article_id = ?", [articleId], function(err, article) {
            if (err) {
                return next(err); // Pass any database errors to the error handling middleware
            }
            if (!article) {
                return res.status(404).send('Article not found');
            }

            // Fetch comments for the article
            global.db.all("SELECT * FROM comments WHERE article_id = ? ORDER BY created_at DESC", [articleId], function(err, comments) {
                if (err) {
                    return next(err); // Pass any database errors to the error handling middleware
                }

                // Fetch tags for the article
                global.db.all("SELECT tag_name FROM tags JOIN article_tags ON tags.tag_id = article_tags.tag_id WHERE article_tags.article_id = ?", [articleId], function(err, tags) {
                    if (err) {
                        return next(err); // Pass any database errors to the error handling middleware
                    }

                    // Check if the user has liked the article
                    global.db.get("SELECT * FROM article_likes WHERE user_id = ? AND article_id = ?", [userId, articleId], function(err, like) {
                        if (err) {
                            return next(err); // Pass any database errors to the error handling middleware
                        }

                        const userHasLiked = !!like;

                        console.log("Current User:", currentUser);
                        res.locals.user = currentUser;
                        // Render the reader-article.ejs template with fetched article, comments, tags, author name, and like status
                        res.render("reader/article.ejs", {
                            article: article,
                            comments: comments,
                            tags: tags.map(function(tag) { 
                                return tag.tag_name
                            }), 
                            userHasLiked: userHasLiked,
                            username: (currentUser && currentUser.username) ? currentUser.username : null,
                            authorName: article.author_name // Pass author_name as authorName to the template
                        });
                    });
                });
            });
        });
    });
});

// Route to increment reads count
router.get("/increment-reads/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;

    // Increment reads count in the database
    const incrementReadsQuery = "UPDATE articles SET reads = reads + 1 WHERE article_id = ?";

    global.db.run(incrementReadsQuery, [articleId], function(err) {
        if (err) {
            console.error("Failed to increment reads count:", err.message);
            return next(err); // Pass the error to the next middleware
        }

        // Redirect to the article page after incrementing reads count
        res.redirect(`/reader/article/${articleId}`);
    });
});

router.post("/toggle-like/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const userId = req.session.user.user_id; // Corrected to use session

    // Check if the user has already liked the article
    global.db.get("SELECT * FROM article_likes WHERE user_id = ? AND article_id = ?", [userId, articleId], function(err, row) {
        if (err) {
            return next(err);
        }

        if (row) {
            // User has already liked the article, so unlike it
            global.db.run("DELETE FROM article_likes WHERE user_id = ? AND article_id = ?", [userId, articleId], function(err) {
                if (err) {
                    return next(err);
                }

                global.db.run("UPDATE articles SET likes = likes - 1 WHERE article_id = ?", [articleId], function(err) {
                    if (err) {
                        return next(err);
                    }

                    res.redirect(`/reader/article/${articleId}`);
                });
            });
        } else {
            // User has not liked the article, so like it
            global.db.run("INSERT INTO article_likes (user_id, article_id) VALUES (?, ?)", [userId, articleId], function(err) {
                if (err) {
                    return next(err);
                }

                global.db.run("UPDATE articles SET likes = likes + 1 WHERE article_id = ?", [articleId], function(err) {
                    if (err) {
                        return next(err);
                    }

                    res.redirect(`/reader/article/${articleId}`);
                });
            });
        }
    });
});

// Route to handle commenting on an article
router.post("/comment/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const { commenter_name, comment_text } = req.body;

    // Validate that comment_text is not empty or null
    if (!comment_text) {
        return res.status(400).send("Comment text is required");
    }

    // Validate that commenter_name is not empty or null
    if (!commenter_name) {
        return res.status(400).send("Commenter name is required");
    }

    // Prepare SQL statement to prevent SQL injection
    // Insert the new comment with the current timestamp
    const query = `
        INSERT INTO comments (article_id, commenter_name, comment_text, created_at) 
        VALUES (?, ?, ?, datetime('now'))
    `;    
    const values = [articleId, commenter_name, comment_text];

    // Execute the SQL statement
    global.db.run(query, values, function(err) {
        if (err) {
            // Log the error and return a 500 status with a message
            console.error(err.message);
            return res.status(500).send("An error occurred while submitting your comment. Please try again later.");
        }

        // Redirect back to the article page after successful comment submission
        res.redirect(`/reader/article/${articleId}`);
    });
});

// Reader settings page
router.get("/settings", function(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'reader') {
        return res.redirect("/login");
    }

    const userId = req.session.user.user_id;
    const currentUser = req.session.user;

    global.db.get("SELECT * FROM users WHERE user_id = ?", [userId], function(err, user) {
        if (err) {
            return next(err); // Handle database errors
        }
            
        if (!user) {
            return res.status(404).send("User not found");
        }
        
        console.log("Current User:", currentUser);
        res.locals.user = currentUser;
        // Render the settings form with fetched details
        res.render("reader/settings.ejs", { user: user, username: (currentUser && currentUser.username) ? currentUser.username : null });
    });
});

// Handle settings update
router.post("/settings", function(req, res, next) {
    const userId = req.session.user.user_id;

    const { new_username, new_password } = req.body;

    // Fetch current user details
    global.db.get("SELECT * FROM users WHERE user_id = ?", [userId], function(err, user) {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(404).send("User not found");
        }

        // Determine if new_username and new_password are provided
        const updatedUser = {
            user_name: new_username || user.user_name, // Use new_username if provided, else keep the current username
            password: new_password || user.password // Use new_password if provided, else keep the current password
        };

        // Update username and password, ensuring username uniqueness
        global.db.get("SELECT * FROM users WHERE user_name = ? AND user_id != ?", [updatedUser.user_name, userId], function(err, existingUser) {
            if (err) {
                return next(err);
            }

            if (existingUser) {
                return res.send("Username already exists. Please choose another one.");
            }

            // Perform the updates
            global.db.run(
                "UPDATE users SET user_name = ?, password = ? WHERE user_id = ?",
                [updatedUser.user_name, updatedUser.password, userId],
                function (err) {
                    if (err) {
                        return next(err);
                    }
                        // Update session with new username if changed
                        if (new_username) {
                            req.session.user.user_name = new_username;
                        }
                        
                        // Redirect to the settings page after successful update
                        res.redirect("/reader/settings");
                        }
                    );
                }
            );
        });
});

// Route to handle searching for articles by tag
router.get("/search", function(req, res, next) {
    const tag = req.query.tag;
    const currentUser = req.session.user;

    if (!tag) {
        return res.status(400).send('Tag is required');
    }

    console.log("Searching for tag:", tag);

    global.db.all("SELECT articles.* FROM articles JOIN article_tags ON articles.article_id = article_tags.article_id JOIN tags ON article_tags.tag_id = tags.tag_id WHERE tags.tag_name = ?", [tag], function(err, articles) {
        if (err) {
            console.error("Database error:", err);
            return next(err); // Pass any database errors to the error handling middleware
        }

        console.log("Current User:", currentUser);
        res.locals.user = currentUser;

        console.log("Found articles:", articles);
        res.render("reader/search-results.ejs", { 
            username: (currentUser && currentUser.username) ? currentUser.username : null,
            articles: articles, 
            searchTag: tag });
    });
});

module.exports = router;