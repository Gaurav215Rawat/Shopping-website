const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const { userExists } = require('../../Checks/user');

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
router.post('/', async (req, res) => {
  const { user_id, address_line, city, state, country, postal_code, is_default } = req.body;

  if (!user_id || !address_line || !city || !state || !country || !postal_code) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    if (!(await userExists(user_id))) {
      return res.status(404).json({ error: 'User not found' });
    }

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
router.put('/edit/:id', async (req, res) => {
  const { id } = req.params;
  const { user_id, address_line, city, state, country, postal_code, is_default } = req.body;

  try {
    if (!(await userExists(user_id))) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await pool.query(
      `UPDATE addresses
       SET address_line = $1, city = $2, state = $3, country = $4, postal_code = $5, is_default = $6
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [address_line, city, state, country, postal_code, is_default, id, user_id]
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
    res.status(500).json({ error: 'Internal server error', message: err.detail });
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
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

module.exports = router;