const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.db');

bcrypt.hash('mypassword', 10).then(hashedPassword => {
    db.get('SELECT * FROM users WHERE email=?', ['admin'], (err, user) => {
        if (user) {
            console.log('Admin account already exists');
            db.close();
            process.exit(0);
        }
        
        db.run(
            'INSERT INTO users(name,email,password,role,bornDate) VALUES(?,?,?,?,?)',
            ['admin', 'admin', hashedPassword, 'admin', new Date().toISOString()],
            (err) => {
                if (err) {
                    console.error('Failed to create admin account:', err);
                } else {
                    console.log('Admin account created successfully!');
                    console.log('Email: admin');
                    console.log('Password: mypassword');
                }
                db.close();
                process.exit(0);
            }
        );
    });
});
