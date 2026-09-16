const express = require("express");
const router = express.Router();

// Author login page
router.get("/login", function(req, res) {
    res.render("author/login.ejs");
});

// Author login handler
router.post("/login", function(req, res, next) {
    // Extract identifier and password from the request body
    const { identifier, password } = req.body; 

    // Define the query and parameters to find the user in the database
    const query = "SELECT * FROM users WHERE (user_name = ? OR email_address = ?) AND role = 'author'";
    const query_parameters = [identifier, identifier];

    // Execute the database query
    global.db.get(query, query_parameters, function(err, user) {
        if (err) {
            // Handle any database errors
            return next(err);
        }

        // Check if the user exists and the password matches
        if (user && user.password === password) {
            // Store user information in the session
            req.session.user = { user_id: user.user_id, role: user.role, username: user.user_name };
            console.log('User session after login:', req.session.user);

            // Redirect the user to the author's home page
            return res.redirect("/author/home");
        }

        // If the login is unsuccessful, send a 401 status with a retry form
        return res.status(401).send(`
            Invalid username, email, or password. 
            <form action="/author/login" method="get">
                <button type="submit">Try again</button>
            </form>
            No account?
            <form action="/users/register" method="get">
                <button type="submit">Register Here</button>
            </form>
        `);
    });
});
// Middleware to check if user is an author
router.use(function(req, res, next) {
    // Log the current user session
    console.log('User session in middleware:', req.session.user); 

    if (req.session.user && req.session.user.role === 'author') {
        // User is an author, proceed to the next middleware or route handler
        next(); 
    } else {
        // User is not an author, deny access
        res.status(403).send('Access denied'); 
    }
});

// Author home page
router.get("/home", function(req, res, next) {
    // Get the user ID from the session
    const userId = req.session.user.user_id; 

    // SQL query to fetch all blogs and their articles for the current author
    const query = `
        SELECT b.blog_id, b.blog_name, a.article_id, a.title, a.content, a.created_at, a.last_modified, a.reads, a.likes, a.state
        FROM blogs b
        LEFT JOIN articles a ON b.blog_id = a.blog_id AND a.author_id = ?
        ORDER BY b.blog_id, a.created_at DESC;
    `;
    const params = [userId];

    // Execute the query to get the blogs and articles
    global.db.all(query, params, function(err, results) {
        if (err) {
            return next(err); // Handle database errors
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
                    articles: []
                };
                blogs.push(currentBlog);
            }
        
            // Add article to current blog's articles if it exists (article_id is not null)
            if (row.article_id) {
                currentBlog.articles.push({
                    article_id: row.article_id,
                    title: row.title,
                    content: row.content,
                    created_at: row.created_at,
                    last_modified: row.last_modified,
                    reads: row.reads,
                    likes: row.likes,
                    state: row.state
                });
            }
        });

        // Separate published articles from drafts
        const publishedBlogs = blogs.filter(function(blog) {
            return blog.articles.some(function(article) {
                return article.state === 'published';
            });
        }).map(function(blog) {
            return {
                ...blog,
                articles: blog.articles.filter(function(article) {
                    return article.state === 'published';
                })
            };
        });

        // Fetch current user information from the session
        const currentUser = req.session.user;
        res.locals.user = currentUser;

        // Render the author-home.ejs template with the fetched data
        res.render("author/home.ejs", {
            blogs: publishedBlogs,
            currentUser: currentUser,
            username: currentUser ? currentUser.username : null
        });
    });
});

// Route to display form for creating a new blog
router.get("/create-blog", function(req, res) {
    // Fetch current user information and set it to res.locals.user
    const currentUser = req.session.user;
    console.log("Current User:", currentUser);
    res.locals.user = currentUser;
    
    // Render the create-blog.ejs template and pass the username
    res.render("author/create-blog.ejs", { 
        username: currentUser ? currentUser.username : null 
    });
});

// Route to handle form submission for creating a new blog
router.post("/create-blog", function(req, res, next) {
    // Extract blogName and authorName from the request body
    const { blogName, authorName } = req.body; 

    // Get the author ID from the session
    const authorId = req.session.user.user_id; 
    
    // Insert the new blog into the blogs table
    const query = "INSERT INTO blogs (blog_name, author_id, author_name) VALUES (?, ?, ?)";
    const values = [blogName, authorId, authorName];

    // Execute the query to insert the new blog
    global.db.run(query, values, function(err) {
        if (err) {
            console.error("Error inserting blog:", err);
            // Handle database errors
            return next(err); 

        } else {
            // Redirect to create draft after creating the blog
            res.redirect("/author/create-draft"); 
        }
    });
});

// Display form to create a new draft
router.get("/create-draft",  function(req, res, next) {
    const authorId = req.session.user.user_id;
    const currentUser = req.session.user;

    // Fetch blogs authored by the current user from the database
    const query = 'SELECT * FROM blogs WHERE author_id = ?';
    const params = [authorId];

    console.log("Current User:", currentUser);
    res.locals.user = currentUser;

    global.db.all(query, params, function(err, blogs) {
        if (err) {
            // Pass any database error to the error handler
            return next(err); 
        }
        // Render the create-draft.ejs template with the filtered blogs data
        res.render("author/create-draft.ejs", { 
            blogs: blogs, 
            username: (currentUser && currentUser.username) ? currentUser.username : null 
        });
    });
});

// Handle form submission to create a new draft
router.post("/create-draft", function(req, res, next) {
    const { title, content, blog_id } = req.body;
    const authorId = req.session.user.user_id;
    const authorName = req.session.user.username; 

    // Check if title, content, and blog_id are provided
    if (!title || !content || !blog_id) {
        return res.status(400).send('Title, content, and blog_id are required');
    }

    global.db.serialize(function() {
        // Start the transaction
        global.db.run("BEGIN TRANSACTION", function(err) {
            if (err) return next(err);
    
            const query = "INSERT INTO articles (title, content, author_id, author_name, blog_id, state) VALUES (?, ?, ?, ?, ?, 'draft')";
            const params = [title, content, authorId, authorName, blog_id];
    
            global.db.run(query, params, function(err) {
                if (err) {
                    // Rollback the transaction in case of an error
                    return global.db.run("ROLLBACK", function(rollbackErr) {
                        if (rollbackErr) return next(rollbackErr);
                        return next(err);
                    });
                }
    
                // Commit the transaction
                global.db.run("COMMIT", function(err) {
                    if (err) {
                        // Rollback the transaction in case of an error during commit
                        return global.db.run("ROLLBACK", function(rollbackErr) {
                            if (rollbackErr) return next(rollbackErr);
                            return next(err);
                        });
                    }
                    // Redirect to the draft articles page after a successful commit
                    res.redirect(`/author/draft-articles`);
                });
            });
        });
    });
});

// Route handler for fetching draft articles
router.get("/draft-articles", function(req, res, next) {
    const userId = req.session.user.user_id;

    // Fetch only draft articles
    const query = `
        SELECT article_id, title, content, created_at, last_modified, reads, likes
        FROM articles
        WHERE author_id = ? AND state = 'draft'
        ORDER BY created_at DESC;
    `;
    const params = [userId];

    global.db.all(query, params, function(err, results) {
        if (err) {
            // Handle database errors
            return next(err); 
        }

        // Render the draft-articles.ejs template with fetched draft articles
        res.render("author/draft-articles.ejs", {
            draftArticles: results,
            currentUser: req.session.user,
            username: req.session.user ? req.session.user.username : null
        });
    });
});

// Publish draft article
router.post("/publish/:articleId", function(req, res, next) {
    // Extract the article ID from the route parameters
    const articleId = req.params.articleId; 
    const query = `
        UPDATE articles 
        SET state = 'published', published_at = datetime('now'), last_modified = datetime('now') 
        WHERE article_id = ?;
    `;
    const params = [articleId];

    // Execute the query to update the article state to 'published'
    global.db.run(query, params, function(err) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        // Redirect to the author home page after publishing
        res.redirect("/author/home"); 
    });
});

// Unpublish article
router.post("/unpublish/:articleId", function(req, res, next) {
    // Extract the article ID from the route parameters
    const articleId = req.params.articleId; 
    const query = `
        UPDATE articles 
        SET state = 'draft', last_modified = datetime('now') 
        WHERE article_id = ?;
    `;
    const params = [articleId];

    // Execute the query to update the article state to 'draft'
    global.db.run(query, params, function(err) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        // Redirect to the draft articles page after unpublishing
        res.redirect("/author/draft-articles"); 
    });
});

// Delete article
router.post("/delete/:articleId", function(req, res, next) {
    // Extract the article ID from the route parameters
    const articleId = req.params.articleId; 

    // SQL query to delete the article
    const query = "DELETE FROM articles WHERE article_id = ?;"; 
    const params = [articleId];

    // Execute the query to delete the article
    global.db.run(query, params, function(err) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        // Redirect to the author home page after deletion
        res.redirect("/author/home"); 
    });
});

// Delete draft
router.post("/delete-draft/:articleId", function(req, res, next) {
    // Extract the article ID from the route parameters
    const articleId = req.params.articleId; 

    // SQL query to delete the article
    const query = "DELETE FROM articles WHERE article_id = ?;"; 
    const params = [articleId];

    // Execute the query to delete the article
    global.db.run(query, params, function(err) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        // Redirect to the draft articles page after deletion
        res.redirect("/author/draft-articles"); 
    });
});

// Get edit article page
router.get("/edit/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const currentUser = req.session.user;

    const authorId = currentUser.user_id;

    // Fetch the article details from the database
    global.db.get("SELECT * FROM articles WHERE article_id = ?", [articleId], function(err, article) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        
        if (!article) {
            // Handle case where article is not found
            return res.status(404).send('Article not found'); 
        }
    
        // Fetch blogs created by the current user for dropdown selection
        global.db.all("SELECT blog_id, blog_name FROM blogs WHERE author_id = ?", [authorId], function(err, blogs) {
            if (err) {
                // Handle database errors
                return next(err); 
            }
    
            global.db.all("SELECT tag_name FROM tags JOIN article_tags ON tags.tag_id = article_tags.tag_id WHERE article_tags.article_id = ?", [articleId], function(err, articleTags) {
                if (err) return next(err);
    
                console.log("Current User:", currentUser);
    
                res.locals.user = currentUser;
                res.render("author/edit-article.ejs", {
                    article: article,
                    blogs: blogs,
                    tags: articleTags.map(function(tag) {
                        return tag.tag_name;
                    }),
                    username: (currentUser && currentUser.username) ? currentUser.username : null
                });
            });
        });
    });
});

// Post edit article
router.post("/edit/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const { title, content, blog_id, tags } = req.body;

    if (!title || !content || !blog_id) {
        return res.status(400).send('Title, content, and blog_id are required');
    }

    global.db.serialize(function() {
        global.db.run("BEGIN TRANSACTION", function(err) {
            if (err) return next(err);
    
            const query = "UPDATE articles SET title = ?, content = ?, blog_id = ?, last_modified = datetime('now') WHERE article_id = ?";
            const params = [title, content, blog_id, articleId];
    
            global.db.run(query, params, function(err) {
                if (err) {
                    return global.db.run("ROLLBACK", function(rollbackErr) {
                        next(rollbackErr || err);
                    });
                }
    
                const deleteTagsQuery = "DELETE FROM article_tags WHERE article_id = ?";
                global.db.run(deleteTagsQuery, [articleId], function(err) {
                    if (err) {
                        return global.db.run("ROLLBACK", function(rollbackErr) {
                            next(rollbackErr || err);
                        });
                    }
    
                    const tagList = tags.split(',').map(function(tag) {
                        return tag.trim();
                    });
                    
                    const tagInsertPromises = tagList.map(function(tag) {
                        return new Promise(function(resolve, reject) {
                            global.db.run("INSERT OR IGNORE INTO tags (tag_name) VALUES (?)", [tag], function(err) {
                                if (err) return reject(err);
    
                                global.db.get("SELECT tag_id FROM tags WHERE tag_name = ?", [tag], function(err, row) {
                                    if (err) return reject(err);
    
                                    global.db.run("INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)", [articleId, row.tag_id], function(err) {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
    
                    Promise.all(tagInsertPromises).then(function() {
                        global.db.run("COMMIT", function(err) {
                            if (err) {
                                return global.db.run("ROLLBACK", function(rollbackErr) {
                                    next(rollbackErr || err);
                                });
                            }
                            res.redirect("/author/home");
                        });
                    }).catch(function(err) {
                        global.db.run("ROLLBACK", function(rollbackErr) {
                            next(rollbackErr || err);
                        });
                    });
                });
            });
        });
    });
});

router.get("/articles/tag/:tagName", function(req, res, next) {
    const tagName = req.params.tagName;

    global.db.all(`
        SELECT articles.* FROM articles
        JOIN article_tags ON articles.article_id = article_tags.article_id
        JOIN tags ON article_tags.tag_id = tags.tag_id
        WHERE tags.tag_name = ?
    `, [tagName], function(err, articles) {
        if (err) return next(err);
        if (!articles || articles.length === 0) return res.status(404).send('No articles found for this tag');
    
        res.render("articles-by-tag.ejs", {
            tagName: tagName,
            articles: articles
        });
    });
});

// Get article details for generic display
router.get("/articles/:id", function(req, res, next) {
    const articleId = req.params.id;
    const query = "SELECT * FROM articles WHERE article_id = ?;";

    global.db.get(query, [articleId], function(err, article) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        if (!article) {
            // Handle case where article is not found
            return res.status(404).send('Article not found'); 
        }
        // Render the generic article view
        res.render("article", { article: article }); 
    });
});

// Get detailed article view for authors
router.get("/article/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const userId = req.session.user.user_id; 
    const currentUser = req.session.user;
    
    // Fetch the article details including author name from the database
    global.db.get("SELECT articles.*, users.user_name AS author_name FROM articles JOIN users ON articles.author_id = users.user_id WHERE article_id = ?", [articleId], function(err, article) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
        if (!article) {
            // Handle case where article is not found
            return res.status(404).send('Article not found'); 
        }
    
        // Fetch comments for the article
        global.db.all("SELECT * FROM comments WHERE article_id = ? ORDER BY created_at DESC", [articleId], function(err, comments) {
            if (err) {
                // Handle database errors
                return next(err); 
            }
    
            // Fetch tags for the article
            global.db.all("SELECT tag_name FROM tags JOIN article_tags ON tags.tag_id = article_tags.tag_id WHERE article_tags.article_id = ?", [articleId], function(err, tags) {
                if (err) {
                    // Handle database errors
                    return next(err); 
                }
    
                // Check if the user has liked the article
                global.db.get("SELECT * FROM article_likes WHERE user_id = ? AND article_id = ?", [userId, articleId], function(err, like) {
                    if (err) {
                        // Handle database errors
                        return next(err); 
                    }
    
                    // Determine if the user has liked the article
                    const userHasLiked = !!like; 
    
                    console.log("Current User:", currentUser);
                    res.locals.user = currentUser;
                    // Render the author-article.ejs template with fetched article, comments, author name, and like status
                    res.render("author/article.ejs", {
                        article: article,
                        comments: comments,
                        tags: tags.map(function(tag) {
                            return tag.tag_name;
                        }),
                        userHasLiked: userHasLiked,
                        username: (currentUser && currentUser.username) ? currentUser.username : null,
                        authorName: article.author_name
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
            // Pass the error to the next middleware
            return next(err); 
        }
    
        // Redirect to the article page after incrementing reads count
        res.redirect(`/author/article/${articleId}`);
    });
});

// Route to handle toggling article like
router.post("/toggle-like/:articleId", function(req, res, next) {
    const articleId = req.params.articleId;
    const userId = req.session.user.user_id;

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
                    // Send success status
                    res.sendStatus(200); 
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
                    // Send success status
                    res.sendStatus(200); 
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
        res.redirect(`/author/article/${articleId}`);
    });
});

// Author settings page
router.get("/settings", function(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'author') {
        // Redirect to login page if not logged in as author
        return res.redirect("/login"); 
    }

    const userId = req.session.user.user_id;
    const currentUser = req.session.user;

    // Fetch author details and their blogs from the database
    global.db.all("SELECT * FROM blogs WHERE author_id = ?", [userId], function(err, blogs) {
        if (err) {
            // Handle database errors
            return next(err); 
        }
    
        // Fetch user details
        global.db.get("SELECT * FROM users WHERE user_id = ?", [userId], function(err, user) {
            if (err) {
                // Handle database errors
                return next(err); 
            }
            
            if (!user) {
                return res.status(404).send("User not found");
            }
            
            console.log("Current User:", currentUser);
            res.locals.user = currentUser;
            
            // Render the settings form with fetched details
            res.render("author/settings.ejs", {
                user: user,
                blogs: blogs,
                username: (currentUser && currentUser.username) ? currentUser.username : null
            });
        });
    });    
});

// Handle settings update
router.post("/settings", function(req, res, next) {
    const userId = req.session.user.user_id;
    const { blog_selector, new_blog_name, new_username, new_password } = req.body;

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
    
                    // Update blog details
                    global.db.run(
                        "UPDATE blogs SET blog_name = ? WHERE blog_id = ? AND author_id = ?",
                        [new_blog_name, blog_selector, userId],
                        function (err) {
                            if (err) {
                                return next(err);
                            }
    
                            // Update session with new username if changed
                            if (new_username) {
                                req.session.user.user_name = new_username;
                            }
    
                            // Redirect to the settings page after successful update
                            res.redirect("/author/settings");
                        }
                    );
                }
            );
        });
    });
});

module.exports = router;