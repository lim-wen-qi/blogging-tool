-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Create your tables with SQL commands here (watch out for slight syntactical differences with SQLite vs MySQL)

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    email_address TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Create blogs table
CREATE TABLE IF NOT EXISTS blogs (
    blog_id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_name TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(user_id)
);

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
    article_id INTEGER PRIMARY KEY AUTOINCREMENT,
    blog_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    state TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
    published_at TEXT,
    reads INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    author_id INTEGER NOT NULL,
    FOREIGN KEY (blog_id) REFERENCES blogs(blog_id),
    FOREIGN KEY (author_id) REFERENCES users(user_id)
);

-- Create article_likes table
CREATE TABLE IF NOT EXISTS article_likes (
    like_id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(article_id, user_id),
    FOREIGN KEY (article_id) REFERENCES articles(article_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    comment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    commenter_name TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(article_id) ON DELETE CASCADE
);

CREATE TABLE tags (
    tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_name TEXT UNIQUE NOT NULL
);

CREATE TABLE article_tags (
    article_id INTEGER,
    tag_id INTEGER,
    FOREIGN KEY (article_id) REFERENCES articles(article_id),
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id),
    PRIMARY KEY (article_id, tag_id)
);


-- Set up users
INSERT INTO users ('user_name', 'role', 'email_address', 'password') VALUES ('Simon Star', 'author', 'simon@gmail.com', 'password1');
INSERT INTO users ('user_name', 'role', 'email_address', 'password') VALUES ('Dianne Dean', 'reader', 'dianne@gmail.com', 'password2');
INSERT INTO users ('user_name', 'role', 'email_address', 'password') VALUES ('Harry Hilbert', 'author', 'harry@gmail.com', 'password3');
INSERT INTO users ('user_name', 'role', 'email_address', 'password') VALUES ('Mary Olivia', 'reader', 'mary@gmail.com', 'password4');

-- Set up blogs
INSERT INTO blogs ('blog_name', 'author_id', 'author_name') VALUES ('Sample Blog', 1, 'Simon Star');
INSERT INTO blogs ('blog_name', 'author_id', 'author_name') VALUES ('Simon Blog', 1, 'Simon Star');
INSERT INTO blogs ('blog_name', 'author_id', 'author_name') VALUES ('Harry Blog', 2, 'Harry Hilbert');


-- Set up articles
INSERT INTO articles (blog_id, author_name, title, content, state, author_id, published_at) VALUES 
(1, 'Simon Star', 'First Blog Post', 'Lorem ipsum dolor sit amet, nec omnium rationibus an. Case probo scripta vel eu. Eum doming philosophia instructior ne, ne debitis ancillae nominati vis, ei vix nobis voluptaria posidonium. Sale vituperatoribus at eos. Phaedrum eloquentiam et pri. Oblique diceret pericula in vix.
Ei epicuri oportere mei. Duo ne duis virtute deserunt, minim accommodare conclusionemque eu eam, congue veritus definitionem mei cu. Has ea eros facer, ea noluisse complectitur deterruisset nec. Per velit nominati complectitur ex, postulant patrioque euripidis ne vel. Vix hinc percipitur consectetuer ex, sit libris petentium id.
Ut errem legendos pri. Sit eripuit imperdiet cu, assum errem usu et. Ne hinc reprehendunt eam. Duo at iusto nostro, eam graeci prompta ut.
Est natum dolorem ne, qui an suas dicat. Usu at omnium graecis omnesque, an mel nusquam accusata urbanitas. Doming epicuri delectus at mel. Erroribus consetetur eu duo, pri praesent imperdiet efficiendi in. Ex graeco discere minimum quo, est posse soluta no.
Errem elitr labitur ex qui, mea wisi posidonium ut. Eu esse voluptua ius, inimicus volutpat eam ne. Ex dicit atomorum dignissim vel, ea ipsum mazim verterem est. Sea ad explicari neglegentur, nam deleniti maiestatis at. Ex duo modo copiosae scriptorem.', 'published', 1, '2024-06-23 12:06:55'),
(2, 'Simon Star', 'Second Blog Post', 'This is the content of the second blog post.', 'published', 1, '2024-06-24 12:14:30'),
(3, 'Harry Hilbert', 'First Blog Post', 'Hello World.', 'published', 3, '2024-06-30 12:13:14'),
(3, 'Harry Hilbert', 'Computer Science', 'Computer Science is fun! I love coding!', 'published', 3, '2024-05-54 16:45:06'),
(1, 'Simon Star', 'Draft Blog Post', 'This is a draft post that has not been published yet.', 'draft', 1, NULL);

-- Insert a comment
INSERT INTO comments (article_id, commenter_name, comment_text, created_at)
VALUES (1, 'Dianne Dean', 'Great first post! Looking forward to more.', '2024-06-25 12:03:20');
INSERT INTO comments (article_id, commenter_name, comment_text, created_at)
VALUES (4, 'Mary Olivia', 'Hi Harry, I love coding too!!', '2024-06-25 18:03:03');


-- Insert tags
INSERT INTO tags (tag_name) VALUES
('lorem'),
('beginner'),
('coding'),
('hello');

-- Associate tags with articles
INSERT INTO article_tags (article_id, tag_id)
VALUES
(1, 1),
(1, 2),
(4, 3),
(3, 4);


COMMIT;

