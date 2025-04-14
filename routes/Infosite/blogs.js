const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');


// 1. GET all blogs
router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM blogs ORDER BY created_at DESC');
      res.json(result.rows); // Return the blogs as JSON
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });
  
  // 2. GET a single blog by id
  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Blog not found' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });
  
  // 3. POST a new blog
  router.post('/', async (req, res) => {
    const { title, content, category,  author, external_link } = req.body;
    
    try {
      const result = await pool.query(
        'INSERT INTO blogs (title, content, category, author, external_link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, content, category, author, external_link]
      );
      res.status(201).json(result.rows[0]); // Return the newly created blog
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });
  
  // 4. DELETE a blog by id
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query('DELETE FROM blogs WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length > 0) {
        res.status(200).json({ message: 'Blog deleted successfully' });
      } else {
        res.status(404).json({ error: 'Blog not found' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });
  
  module.exports = router;