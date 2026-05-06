const fs = require('fs/promises');
const path = require('path');
const pool = require('../src/db/pool');

async function setupDatabase() {
  const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema is ready.');
}

setupDatabase()
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
