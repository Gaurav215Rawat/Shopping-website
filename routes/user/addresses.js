const express = require('express');
const router = express.Router();
const authenticateToken = require('../../middleware/jwt');
const { pool } = require('../../config/dbconfig');


/**
 * @swagger
 * tags:
 *   name: Address
 *   description: Address management APIs
 */

/**
 * @swagger
 * /address:
 *   post:
 *     summary: Add a new address
 *     tags: [Address]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, address_line, city, state, country, postal_code]
 *             properties:
 *               user_id: { type: integer }
 *               address_line: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string }
 *               postal_code: { type: string }
 *               is_default: { type: boolean }
 *     responses:
 *       201:
 *         description: Address added successfully
 *       400:
 *         description: Missing fields
 *       404:
 *         description: User not found
 */
router.post('/',authenticateToken, async (req, res) => {
  const { user_id, full_name, phone_no, address_line, city, state, country, postal_code, is_default } = req.body;

  if (!user_id || !address_line || !city || !state || !country || !postal_code) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    if (!user_id || !full_name || !phone_no || !address_line || !city || !state || !country || !postal_code) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if this address already exists for the user
    const existing = await pool.query(
      `SELECT id FROM addresses 
       WHERE user_id = $1 AND full_name = $2 AND phone_no = $3 AND address_line = $4 
         AND city = $5 AND state = $6 AND country = $7 AND postal_code = $8`,
      [user_id, full_name, phone_no, address_line, city, state, country, postal_code]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Address already exists.' });
    }

    const result = await pool.query(
      `INSERT INTO addresses 
        (user_id, full_name, phone_no, address_line, city, state, country, postal_code, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [user_id, full_name, phone_no, address_line, city, state, country, postal_code, is_default ?? false]
    );

    res.status(201).json({
      message: 'Address added successfully.',
      address: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding address:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

/**
 * @swagger
 * /address/edit/{id}:
 *   put:
 *     summary: Update an address
 *     tags: [Address]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id: { type: integer }
 *               address_line: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string }
 *               postal_code: { type: string }
 *               is_default: { type: boolean }
 *     responses:
 *       200:
 *         description: Address updated
 *       404:
 *         description: Address or user not found
 */
router.put('/edit/:id',authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { user_id, full_name, phone_no, address_line, city, state, country, postal_code } = req.body;

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await pool.query(
      `UPDATE addresses
       SET full_name = $1, phone_no = $2, address_line = $3, city = $4, state = $5,
           country = $6, postal_code = $7 WHERE id = $8 AND user_id = $9
       RETURNING *`,
       [full_name, phone_no, address_line, city, state, country, postal_code, id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Address not found' });
    }

    res.json({ message: 'Address updated', address: result.rows[0] });
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});


router.put('/default/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  try {
    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Begin transaction
    await pool.query('BEGIN');

    // Set all user's addresses to is_default = false
    await pool.query(
      `UPDATE addresses SET is_default = false WHERE user_id = $1`,
      [user_id]
    );

    // Set the specified address to is_default = true
    const result = await pool.query(
      `UPDATE addresses
       SET is_default = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, user_id]
    );

    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Address not found' });
    }

    // Commit transaction
    await pool.query('COMMIT');

    res.json({ message: 'Default address updated', address: result.rows[0] });

  } catch (err) {
    console.error('Error updating default address:', err);
    await pool.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

/**
 * @swagger
 * /address/delete/{id}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Address]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Address deleted
 *       404:
 *         description: Address not found
 */
router.delete('/delete/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the address before deletion to check if it's default and get user_id
    const addressResult = await client.query(
      'SELECT user_id, is_default FROM addresses WHERE id = $1',
      [id]
    );

    if (addressResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Address not found' });
    }

    const { user_id, is_default } = addressResult.rows[0];

    // 2. Delete the address
    await client.query('DELETE FROM addresses WHERE id = $1', [id]);

    // 3. If the deleted address was default, set another one as default
    if (is_default) {
      const otherAddress = await client.query(
        'SELECT id FROM addresses WHERE user_id = $1 LIMIT 1',
        [user_id]
      );

      if (otherAddress.rows.length > 0) {
        const newDefaultId = otherAddress.rows[0].id;
        await client.query(
          'UPDATE addresses SET is_default = true WHERE id = $1',
          [newDefaultId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Address deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting address:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  } finally {
    client.release();
  }
});


/**
 * @swagger
 * /address/user/{user_id}:
 *   get:
 *     summary: Get all addresses of a user
 *     tags: [Address]
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of addresses
 */
router.get('/user/:user_id',authenticateToken, async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1',
      [user_id]
    );

    res.json({ addresses: result.rows });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

module.exports = router;