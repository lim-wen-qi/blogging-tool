const express = require("express");
const router = express.Router();

// Register user route
router.get("/register", function(req, res) {
    res.render("register.ejs");
});

router.post("/register", function(req, res, next) {
    const { user_name, role, email_address, password } = req.body;
    const query = "INSERT INTO users (user_name, role, email_address, password) VALUES( ?, ?, ?, ? );";
    const query_parameters = [user_name, role, email_address, password];
    
    global.db.run(query, query_parameters, function (err) {
        if (err) {
            return next(err);
        } else {
            res.send(`New user registered with username: ${user_name} and email: ${email_address}! <a href="/">Login</a> now!`);
        }
    });
});

module.exports = router;
