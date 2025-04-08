const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig'); // update path if needed



// Add new address
router.post('/add', async (req, res) => {
  const { user_id, address_line, city, state, country, postal_code, is_default } = req.body;

// Check for required fields
if (!user_id || !address_line || !city || !state || !country || !postal_code) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Verify if the user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Insert new address
    const result = await pool.query(
      `INSERT INTO addresses 
        (user_id, address_line, city, state, country, postal_code, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, address_line, city, state, country, postal_code, is_default ?? false]
    );

    res.status(201).json({
      message: 'Address added successfully.',
      address: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding address:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Update address
router.put('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id,address_line, city, state, country, postal_code, is_default } = req.body;

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const result = await pool.query(
      `UPDATE addresses
       SET address_line = $1, city = $2, state = $3, country = $4, postal_code = $5, is_default = $6
       WHERE id = $7 AND user_id= $8
       RETURNING *`,
      [address_line, city, state, country, postal_code, is_default, id,user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({ message: 'Address updated', address: result.rows[0] });
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Delete address
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM addresses WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({ message: 'Address deleted successfully' });
  } catch (err) {
    console.error('Error deleting address:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// (Optional) Get all addresses for a user
router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1',
      [user_id]
    );

    res.json({ addresses: result.rows });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
