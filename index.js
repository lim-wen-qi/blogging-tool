/**
* index.js
* This is your main app entry point
*/

// Import necessary modules
const express = require('express');
const session = require('express-session');
const bodyParser = require("body-parser");
const sqlite3 = require('sqlite3').verbose();

const usersRoutes = require('./routes/users');
const authorRoutes = require('./routes/author');
const readerRoutes = require('./routes/reader');

const app = express();
const port = 3000;

// Set up session middleware
app.use(session({
    secret: 'your_secret_key', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure to true if using HTTPS
}));

// Set up body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set view engine to EJS
app.set('view engine', 'ejs');

// Serve static files from the "public" directory
app.use(express.static(__dirname + '/public'));

// Set up the SQLite database connection
global.db = new sqlite3.Database('./database.db', function (err) {
    if (err) {
        console.error(err.message);
        process.exit(1); // Exit the process with an error code
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

// Define the root route
app.get('/', (req, res) => {
    res.render('main.ejs');
});

// Define routes for users, authors, and readers
app.use('/users', usersRoutes);
app.use('/author', authorRoutes);
app.use('/reader', readerRoutes);

// Error handling middleware for 404 - Not Found
app.use((req, res, next) => {
    res.status(404).send('Page not found');
});

// Error handling middleware for other errors
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send('Something went wrong');
});

// Start the server
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});

// Set environment to development
app.set('env', 'development');

