// ==================== DEPENDENCIES & SETUP ====================
// Import all required modules for the Express server
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bananaApp = express();

// ==================== REQUEST LOGGING ====================
// Log all incoming requests to console for debugging
bananaApp.use((req, res, next) => {
    console.log(new Date().toISOString(), req.method, req.url);
    next();
});
// ==================== FILE UPLOAD CONFIGURATION ====================
// Configure multer for handling file uploads (listing images)
// Files are stored in the /uploads directory with unique names
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_'));
    }
});
const upload = multer({ storage });
// ==================== DATABASE SETUP ====================
// Initialize SQLite database connection
const goofyBase = new sqlite3.Database('./database.db');
// ==================== MIDDLEWARE CONFIGURATION ====================
// Serve static files (HTML, CSS, JS, images)
bananaApp.use(express.static(__dirname));
// Parse URL-encoded form data
bananaApp.use(bodyParser.urlencoded({ extended: true }));
// Parse JSON request bodies
bananaApp.use(express.json());
// Configure session management for user authentication
bananaApp.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// ==================== SESSION & USER CONTEXT ====================
// Make current user available to response locals
bananaApp.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// ==================== DATABASE INITIALIZATION ====================
// Create tables if they don't exist and set up admin account
goofyBase.serialize(() => {
    // Users table: stores account information with hashed passwords
    goofyBase.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user',
            bornDate TEXT
        )
    `);

// Listings table: stores marketplace listings with owner and image references
    goofyBase.run(`
        CREATE TABLE IF NOT EXISTS spaceItems (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coolName TEXT,
            blahBlah TEXT,
            moneyNumber TEXT,
            ringRing TEXT,
            phone TEXT,
            image TEXT,
            guyWhoOwnsIt INTEGER
        )
    `);

    // Saved listings: maps users to listings they've saved
    goofyBase.run(`
        CREATE TABLE IF NOT EXISTS savedListings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            listingId INTEGER,
            UNIQUE(userId, listingId)
        )
    `);

// Create default admin account if it doesn't exist
// Admin credentials: email="admin", password="mypassword"
    goofyBase.get('SELECT * FROM users WHERE email=?', ['admin'], (err, user) => {
        if (!user) {
            bcrypt.hash('mypassword', 10).then(hashedPassword => {
                goofyBase.run(
                    'INSERT INTO users(name,email,password,role,bornDate) VALUES(?,?,?,?,?)',
                    ['admin', 'admin', hashedPassword, 'admin', new Date().toISOString()],
                    (err) => {
                        if (err) {
                            console.error('Failed to create admin account:', err);
                        } else {
                            console.log('Admin account created: admin / mypassword');
                        }
                    }
                );
            });
        }
    });
});

// ==================== HOME PAGE ====================
// Serve the home page with all listings
bananaApp.get('/', (req, res) => {
    res.sendFile(__dirname + '/home.html');
});

// ==================== LISTINGS ENDPOINTS ====================
// Get all listings (displayed on home page)
bananaApp.get('/listings', (req, res) => {
    goofyBase.all('SELECT * FROM spaceItems ORDER BY id DESC', [], (err, spaceItems) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(spaceItems);
    });
});

// ==================== AUTHENTICATION PAGE ====================
// Serve login/register page
bananaApp.get('/auth', (req, res) => {
    res.sendFile(__dirname + '/auth.html');
});

// ==================== REGISTRATION ====================
// Create a new user account
// Request body: { name, email, password }
// On success: logs user in and returns redirect to profile
bananaApp.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    console.log('POST /register', { name, email: email ? (email.replace(/(.)(.*)/, '$1***')) : null });
    if (!name || !email || !password) {
        return res.json({ success: false, message: 'Fill all fields' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        goofyBase.run(
            'INSERT INTO users(name,email,password,bornDate) VALUES(?,?,?,?)',
            [name, email, hashedPassword, new Date().toISOString()],
            function(err) {
                if (err) {
                    console.error('DB insert user error:', err);
                    return res.json({ success: false, message: 'Account already exists' });
                }
                const userId = this.lastID;
                req.session.user = {
                    id: userId,
                    name,
                    email,
                    role: 'user',
                    bornDate: new Date().toISOString()
                };
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error after register:', err);
                        return res.json({ success: false, message: 'Server error' });
                    }
                    res.json({ success: true, redirect: '/human-corner' });
                });
            }
        );
    } catch (e) {
        console.error('Register error:', e);
        res.json({ success: false, message: 'Server error' });
    }
});

// ==================== LOGIN ====================
// Authenticate user with email/username and password
// Request body: { identifier (email or username), password }
// On success: creates session and returns redirect to profile
bananaApp.post('/login', async (req, res) => {
    const { identifier, password } = req.body;

    console.log('POST /login', { identifier: identifier ? (identifier.replace(/(.)(.*)/, '$1***')) : null });

    if (!identifier || !password) {
        return res.json({ success: false, message: 'Fill all fields' });
    }

    goofyBase.get(
        'SELECT * FROM users WHERE email=? OR name=?',
        [identifier, identifier],
        async (err, user) => {
            if (err) {
                console.error('DB get user error:', err);
                return res.json({ success: false, message: 'Database error' });
            }

            if (!user) {
                return res.json({ success: false, message: 'User not found' });
            }

            const passwordMatches = await bcrypt.compare(password, user.password);

            if (!passwordMatches) {
                return res.json({ success: false, message: 'Wrong password' });
            }

            let bornDate = user.bornDate;
            if (!bornDate) {
                bornDate = new Date().toISOString();
                goofyBase.run('UPDATE users SET bornDate=? WHERE id=?', [bornDate, user.id], (uErr) => {
                    if (uErr) console.error('Failed to update bornDate for user', uErr);
                });
            }

            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                bornDate: bornDate
            };

            req.session.save((err) => {
                if (err) {
                    console.error('Session save error after login:', err);
                    return res.json({ success: false, message: 'Server error' });
                }
                res.json({ success: true, redirect: '/human-corner' });
            });
        }
    );
});

// ==================== LOGOUT ====================
// Destroy user session and redirect to home
bananaApp.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});


// ==================== USER PROFILE PAGE ====================
// Display user's profile page (requires login)
// Shows account creation date and days since account creation
bananaApp.get('/human-corner', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    goofyBase.all(
        'SELECT * FROM spaceItems WHERE guyWhoOwnsIt=?',
        [req.session.user.id],
        (err, spaceItems) => {
            const created = new Date(req.session.user.bornDate);
            const now = new Date();
            const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
            res.sendFile(__dirname + '/human-corner.html');
        }
    );
});

// ==================== UPDATE PROFILE ====================
// Update user's name, email, and optionally password
// Request body: { name, email, password (optional) }
bananaApp.post('/update-human-corner', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }
    const { name, email, password } = req.body;
    
    try {
        // If password is provided, hash it
        if (password && password.trim()) {
            const hashedPassword = await bcrypt.hash(password, 10);
            goofyBase.run(
                'UPDATE users SET name=?, email=?, password=? WHERE id=?',
                [name, email, hashedPassword, req.session.user.id],
                () => {
                    req.session.user.name = name;
                    req.session.user.email = email;
                    res.redirect('/human-corner');
                }
            );
        } else {
            // No password change, just update name and email
            goofyBase.run(
                'UPDATE users SET name=?, email=? WHERE id=?',
                [name, email, req.session.user.id],
                () => {
                    req.session.user.name = name;
                    req.session.user.email = email;
                    res.redirect('/human-corner');
                }
            );
        }
    } catch (e) {
        console.error('Profile update error:', e);
        res.redirect('/human-corner');
    }
});

// ==================== DELETE ACCOUNT ====================
// Permanently delete user account and all their listings
bananaApp.get('/delete-account', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }
    const id = req.session.user.id;
    // First delete all listings owned by user
    goofyBase.run('DELETE FROM spaceItems WHERE guyWhoOwnsIt=?', [id], () => {
        // Then delete the user account
        goofyBase.run('DELETE FROM users WHERE id=?', [id], () => {
            req.session.destroy();
            res.redirect('/');
        });
    });
});

// ==================== CREATE LISTING PAGE ====================
// Serve the create listing form (requires login)
bananaApp.get('/create', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }
    res.sendFile(__dirname + '/create.html');
});

// ==================== CREATE LISTING ====================
// Save a new marketplace listing with optional image upload
// Form fields: title, description, price, category, phone, image (optional)
// Image is saved to /uploads directory and path stored in database
bananaApp.post('/create', upload.single('image'), (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth');
    }

    if (!req.body) {
        console.error('POST /create: req.body is undefined');
        return res.status(400).send('Bad request');
    }

    const body = req.body || {};
    const coolName = body.title || '';
    const blahBlah = body.description || '';
    const moneyNumber = body.price || '';
    const ringRing = body.category || '';
    const phone = body.phone || '';
    const imagePath = req.file ? '/uploads/' + req.file.filename : null;

    goofyBase.run(
        'INSERT INTO spaceItems(coolName,blahBlah,moneyNumber,ringRing,phone,guyWhoOwnsIt,image) VALUES(?,?,?,?,?,?,?)',
        [coolName, blahBlah, moneyNumber, ringRing, phone, req.session.user.id, imagePath],
        function(err) {
            if (err) {
                console.error('DB insert listing error:', err.message || err);
                return res.status(500).send('DB error: ' + (err.message || 'unknown'));
            }
            res.redirect('/');
        }
    );
});

// ==================== EDIT LISTING PAGE ====================
// Display edit form for a listing (owner or admin only)
bananaApp.get('/edit/:id', (req, res) => {
    goofyBase.get('SELECT * FROM spaceItems WHERE id=?', [req.params.id], (err, spaceThing) => {
        if (!spaceThing) {
            return res.redirect('/');
        }
        // Check if user is owner or admin
        if (
            spaceThing.guyWhoOwnsIt !== req.session.user.id &&
            req.session.user.role !== 'admin'
        ) {
            return res.send('No permission');
        }
        res.sendFile(__dirname + '/edit.html');
    });
});

// ==================== UPDATE LISTING ====================
// Update listing details (owner or admin only)
bananaApp.post('/edit/:id', (req, res) => {
    const body = req.body || {};
    const coolName = body.title || '';
    const blahBlah = body.description || '';
    const moneyNumber = body.price || '';
    const ringRing = body.category || '';
    const phone = body.phone || '';
    goofyBase.run(
        'UPDATE spaceItems SET coolName=?, blahBlah=?, moneyNumber=?, ringRing=?, phone=? WHERE id=?',
        [coolName, blahBlah, moneyNumber, ringRing, phone, req.params.id],
        () => {
            res.redirect('/human-corner');
        }
    );
});

// ==================== GET CURRENT USER INFO ====================
// Return logged-in user's information (JSON API for frontend)
// Used to check if user is authenticated and get their details
bananaApp.get('/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    const created = new Date(req.session.user.bornDate);
    const now = new Date();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    res.json({ user: req.session.user, created: req.session.user.bornDate, days });
});

// ==================== GET USER'S LISTINGS ====================
// Return all listings created by logged-in user (JSON API for frontend)
bananaApp.get('/my-listings', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    goofyBase.all('SELECT * FROM spaceItems WHERE guyWhoOwnsIt=? ORDER BY id DESC', [req.session.user.id], (err, items) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(items);
    });
});

// Toggle saved listing for current user
bananaApp.post('/toggle-save/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    const listingId = req.params.id;
    goofyBase.get('SELECT * FROM savedListings WHERE userId=? AND listingId=?', [req.session.user.id, listingId], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (row) {
            goofyBase.run('DELETE FROM savedListings WHERE id=?', [row.id], function(err) {
                if (err) return res.status(500).json({ error: 'DB error' });
                res.json({ saved: false });
            });
        } else {
            goofyBase.run('INSERT INTO savedListings(userId,listingId) VALUES(?,?)', [req.session.user.id, listingId], function(err) {
                if (err) return res.status(500).json({ error: 'DB error' });
                res.json({ saved: true });
            });
        }
    });
});

// Get saved listings for current user
bananaApp.get('/saved-listings', (req, res) => {
    if (!req.session.user) return res.status(401).json([]);
    goofyBase.all('SELECT s.* FROM spaceItems s JOIN savedListings sv ON sv.listingId=s.id WHERE sv.userId=? ORDER BY s.id DESC', [req.session.user.id], (err, items) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(items);
    });
});

// Get saved listing IDs for current user
bananaApp.get('/saved-ids', (req, res) => {
    if (!req.session.user) return res.status(200).json([]);
    goofyBase.all('SELECT listingId FROM savedListings WHERE userId=?', [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows.map(r => r.listingId));
    });
});

// ==================== GET SINGLE LISTING ====================
// Return details for a specific listing (JSON API for frontend modal)
bananaApp.get('/listing/:id', (req, res) => {
    goofyBase.get('SELECT * FROM spaceItems WHERE id=?', [req.params.id], (err, item) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json(item);
    });
});

bananaApp.get('/delete/:id', (req, res) => {
    goofyBase.get('SELECT * FROM spaceItems WHERE id=?', [req.params.id], (err, spaceThing) => {
        if (!spaceThing) {
            return res.redirect('/');
        }
        // Check if user is owner or admin
        if (
            spaceThing.guyWhoOwnsIt !== req.session.user.id &&
            req.session.user.role !== 'admin'
        ) {
            return res.send('No permission');
        }
        goofyBase.run('DELETE FROM spaceItems WHERE id=?', [req.params.id], () => {
            res.redirect('/human-corner');
        });
    });
});

// serve a blank response for favicon requests to avoid noisy 404s
bananaApp.get('/favicon.ico', (req, res) => res.status(204).end());

// ==================== 404 ERROR HANDLER ====================
// Catch-all for undefined routes
bananaApp.use((req, res) => {
    console.log('No route for', req.method, req.url);
    res.status(404).send('Not Found');
});

// ==================== START SERVER ====================
// Listen on port 3000
bananaApp.listen(3000, () => {
    console.log('Running on http://localhost:3000');
});