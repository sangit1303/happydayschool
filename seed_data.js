const db = require('./database');

db.serialize(() => {
    // Add a Branch
    db.run("INSERT INTO branches (name, location) VALUES (?, ?)", ['North Wing', 'North St'], function (err) {
        if (err) console.error('Branch Error:', err);
        else console.log('Branch added:', this.lastID);
    });

    // Add a User
    db.run("INSERT INTO users (username, password, role, branch_id) VALUES (?, ?, ?, ?)", ['manager1', 'pass123', 'manager', 1], function (err) {
        if (err) console.error('User Error:', err);
        else console.log('User added:', this.lastID);
    });
});
