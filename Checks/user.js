// utils/user.js
const pool = require('../config/dbconfig');

async function userExists(userId) {
  const client = await pool.connect();
  try {
    const user = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    return user.rows.length > 0;
  } catch (err) {
    console.error('Error checking user existence:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  userExists,
};
