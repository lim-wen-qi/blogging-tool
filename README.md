# Blogging Tool — Full-Stack Web Application

A full-stack blogging web application developed using Node.js, Express, EJS and SQLite, where authors can create and manage articles while readers can browse and interact with published content.

## Demo

https://github.com/user-attachments/assets/f789e05f-deb4-4244-91b5-199ecd182651

## About

Blogging Tool is a web application that provides separate functionality for authors and readers.

Authors can create and manage blogs and articles, while readers can browse articles, leave comments, like articles, and search for content using tags.

## Key Features

- Author and reader user roles
- Blog and article creation and management
- Article commenting and likes
- Tagging system for organising articles
- Search articles by tags
- User authentication
- Relational database for storing users, blogs, articles and interactions

## Technical Implementation

The application was developed using Node.js and Express with EJS for server-side rendered pages and SQLite for persistent data storage.

The project follows a three-tier structure separating the presentation, application logic and data layers.

### Application Architecture

The presentation layer uses EJS templates for the author and reader interfaces, with CSS and JavaScript used for styling and client-side interactions.

Express routes handle the application's server-side logic, including separate routes for users, authors and readers.

SQLite is used as the data layer to store users, blogs, articles, comments, likes and tags.

<img width="527" height="919" alt="image" src="https://github.com/user-attachments/assets/8f419f79-a55a-4b70-8b3b-0785a4e089ca" />


### Database Design

The application uses a relational SQLite database containing tables for users, blogs, articles, comments, article likes and tags.

Relationships between the tables are implemented using primary and foreign keys. A junction table, `article_tags`, is used to represent the many-to-many relationship between articles and tags.

<img width="771" height="874" alt="image" src="https://github.com/user-attachments/assets/90b92c93-588c-4079-a843-1f665fa97e31" />


### Tagging & Search System

Authors can assign multiple tags to an article when creating or editing content.

Tags are stored in the `tags` table and associated with articles through the `article_tags` junction table.

Readers can search for articles using a tag. The backend performs a SQL query across the `articles`, `article_tags` and `tags` tables to retrieve articles associated with the selected tag.

### Author & Reader Interfaces

The application provides separate interfaces for authors and readers.

Authors can manage their blogs and articles, while readers can browse published content and interact with articles through features such as comments, likes and tag-based search.

## Technologies

- Node.js
- Express.js
- EJS
- SQLite
- JavaScript
- HTML
- CSS

## Project Context

**Individual Databases, Networks and the Web Project**  
Bachelor of Science (Honours) in Computer Science  
University of London  
CM2040 — Databases, Networks and the Web
