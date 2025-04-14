const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');

// GET all job listings
router.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM job_listings ORDER BY id');
    client.release();
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new job listing
router.post('/', async (req, res) => {
  const { title, location, job_type, skills, experience } = req.body;
  try {
    const client = await pool.connect();
    const result = await client.query(
      'INSERT INTO job_listings (title, location, job_type, skills, experience) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, location, job_type, skills, experience]
    );
    client.release();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a job listing by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    const result = await client.query('DELETE FROM job_listings WHERE id = $1 RETURNING *', [id]);
    client.release();
    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Job listing not found' });
    } else {
      res.status(200).json({ message: 'Job listing deleted', data: result.rows[0] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
