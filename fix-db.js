const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.all("PRAGMA table_info(spaceItems)", (err, columns) => {
        if (err) {
            console.error('Error checking table:', err);
            db.close();
            return;
        }

        if (!columns || columns.length === 0) {
            // Table doesn't exist: create with expected schema
            console.log('spaceItems table missing. Creating with expected columns...');
            db.run(`
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
            `, (createErr) => {
                if (createErr) console.error('Error creating spaceItems table:', createErr);
                else console.log('spaceItems table created');
                db.close();
            });
            return;
        }

        const existing = columns.map(c => c.name);
        const needed = [
            { name: 'coolName', sql: 'TEXT' },
            { name: 'blahBlah', sql: 'TEXT' },
            { name: 'moneyNumber', sql: 'TEXT' },
            { name: 'ringRing', sql: 'TEXT' },
            { name: 'phone', sql: 'TEXT' },
            { name: 'image', sql: 'TEXT' },
            { name: 'guyWhoOwnsIt', sql: 'INTEGER' }
        ];

        const toAdd = needed.filter(n => !existing.includes(n.name));
        if (toAdd.length === 0) {
            console.log('All expected columns exist in spaceItems');
            db.close();
            return;
        }

        let pending = toAdd.length;
        toAdd.forEach(col => {
            console.log('Adding column', col.name);
            db.run(`ALTER TABLE spaceItems ADD COLUMN ${col.name} ${col.sql}`, (addErr) => {
                if (addErr) console.error('Error adding', col.name, addErr);
                else console.log('Added column', col.name);
                pending--;
                if (pending === 0) db.close();
            });
        });
    });
});
