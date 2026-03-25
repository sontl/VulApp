const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function seed(db) {
  console.log('Seeding database with testing data...');

  db.serialize(() => {
    db.run(`DELETE FROM files`);
    db.run(`DELETE FROM projects`);
    db.run(`DELETE FROM users`);

    db.run(`DELETE FROM sqlite_sequence WHERE name='files'`);
    db.run(`DELETE FROM sqlite_sequence WHERE name='projects'`);
    db.run(`DELETE FROM sqlite_sequence WHERE name='users'`);

    const users = [
      { email: 'test@example.com', password: '123456', plan: 'free' },
      { email: 'admin@vulapp.com', password: 'admin', plan: 'enterprise' },
      { email: 'user@vulapp.com', password: 'user123', plan: 'pro' },
      { email: 'root@vulapp.com', password: 'root', plan: 'enterprise' }
    ];

    const insertUser = db.prepare(`INSERT INTO users (email, password, plan_type) VALUES (?, ?, ?)`);
    users.forEach(u => insertUser.run(u.email, u.password, u.plan));
    insertUser.finalize();

    const projects = [
      { name: 'Alpha Project', description: 'This is the first project.', owner_id: 1, is_public: 0 },
      { name: 'Beta Project', description: 'Public beta project testing.', owner_id: 1, is_public: 1 },
      { name: 'Admin Secrets', description: 'Super confidential data.', owner_id: 2, is_public: 0 },
      { name: 'XSS Test Project', description: '<img src=x onerror=alert("XSS_Executed")>', owner_id: 2, is_public: 1 },
      { name: 'User Notes', description: 'Personal notes for user.', owner_id: 3, is_public: 0 },
      { name: 'CSV Injection', description: '=CMD("calc")', owner_id: 3, is_public: 1 }
    ];

    const insertProject = db.prepare(`INSERT INTO projects (name, description, owner_id, is_public) VALUES (?, ?, ?, ?)`);
    projects.forEach(p => insertProject.run(p.name, p.description, p.owner_id, p.is_public));
    insertProject.finalize();

    const files = [
      { filename: 'report_q1.pdf', filepath: 'uploads/report_q1.pdf', project_id: 1, owner_id: 1 },
      { filename: 'logo.png', filepath: 'uploads/logo.png', project_id: 2, owner_id: 1 },
      { filename: 'confidential.txt', filepath: 'uploads/confidential.txt', project_id: 3, owner_id: 2 },
      { filename: 'malicious.svg', filepath: 'uploads/malicious.svg', project_id: 4, owner_id: 2 }
    ];

    const insertFile = db.prepare(`INSERT INTO files (filename, filepath, project_id, owner_id) VALUES (?, ?, ?, ?)`);
    files.forEach(f => insertFile.run(f.filename, f.filepath, f.project_id, f.owner_id));
    insertFile.finalize(() => {
      console.log('Database seeded successfully!');
    });
  });
}

// Allow running directly: node seed.js
if (require.main === module) {
  const dbPath = path.resolve(__dirname, 'database.sqlite');
  const db = new sqlite3.Database(dbPath);
  seed(db);
}

module.exports = seed;
