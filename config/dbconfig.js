require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.String, // This should point to your database URL
    //connectionString: process.env.String,
  
  ssl: {
    rejectUnauthorized: false, // Required for most managed databases, including Render
  }
});

module.exports = { pool };
