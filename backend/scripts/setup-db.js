const { Client, Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// PostgreSQL configuration from environment variables
const config = {
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  password: process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.PGPORT || '5432'),
};

// Maximum retries for connecting to PostgreSQL
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function connectWithRetry(clientConfig, retries = MAX_RETRIES) {
  const client = new Client(clientConfig);
  
  try {
    console.log(`Attempting to connect to PostgreSQL at ${clientConfig.host}:${clientConfig.port}...`);
    await client.connect();
    console.log('Successfully connected to PostgreSQL');
    return client;
  } catch (err) {
    if (retries <= 0) {
      console.error('Max connection retries reached. Failed to connect to PostgreSQL:', err);
      throw err;
    }
    
    console.warn(`Failed to connect to PostgreSQL. Retrying in ${RETRY_DELAY_MS / 1000} seconds... (${retries} attempts left)`);
    await sleep(RETRY_DELAY_MS);
    return connectWithRetry(clientConfig, retries - 1);
  }
}

async function setup() {
  let client;
  
  try {
    // Connect to default database with retry
    client = await connectWithRetry({
      ...config,
      database: 'postgres', // Connect to default database
    });
    
    // Check if database exists
    const dbCheckResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.PGDATABASE || 'ast_analysis']
    );
    
    // Create database if it doesn't exist
    if (dbCheckResult.rows.length === 0) {
      console.log(`Creating database ${process.env.PGDATABASE || 'ast_analysis'}...`);
      await client.query(`CREATE DATABASE ${process.env.PGDATABASE || 'ast_analysis'}`);
      console.log('Database created successfully');
    } else {
      console.log(`Database ${process.env.PGDATABASE || 'ast_analysis'} already exists`);
    }
    
    await client.end();
    
    // Connect to the target database with retry
    const dbClient = await connectWithRetry({
      ...config,
      database: process.env.PGDATABASE || 'ast_analysis',
    });
    
    // Read schema SQL file
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    console.log(`Reading schema from ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema SQL
    console.log('Creating database schema...');
    await dbClient.query(schemaSql);
    console.log('Database schema created successfully');
    
    // Verify tables were created
    const tablesResult = await dbClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
    await dbClient.end();
    
    console.log('Database setup completed successfully');
  } catch (err) {
    console.error('Error setting up database:', err);
    if (client) {
      await client.end().catch(console.error);
    }
    process.exit(1);
  }
}

// Run setup
setup();