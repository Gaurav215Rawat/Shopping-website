const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');


// ======================================================
// 🔹 1. POST Comment on a Blog
// ======================================================
router.post('/comments/:id', async (req, res) => {
    const blog_id = req.params.id;
    const { username, comment } = req.body;
  
    try {
      const result = await pool.query(`
        INSERT INTO blog_comments (blog_id, username, comment) 
        VALUES ($1, $2, $3)
        RETURNING *
      `, [blog_id, username, comment]);
  
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to post comment', message: err.detail });
    }
  });
  
  // ======================================================
  // 🔹 2. GET Comments for a Blog
  // ======================================================
  router.get('/comments/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const result = await pool.query(
        'SELECT * FROM blog_comments WHERE blog_id = $1 ORDER BY posted_at ASC',
        [id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch comments', message: err.detail });
    }
  });
  
  //Update Likes for a Comment
  router.patch('/blogs/comments/:id/like', async (req, res) => {
    const commentId = req.params.id;
    const { likes } = req.body;
  
    try {
      const result = await pool.query(
        'UPDATE blog_comments SET likes = $1 WHERE id = $2 RETURNING *',
        [likes, commentId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
  
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update likes', message: err.message });
    }
  });
  
  //Update Comment Text Only
  router.patch('/blogs/comments/:id', async (req, res) => {
    const commentId = req.params.id;
    const { comment } = req.body;
  
    try {
      const result = await pool.query(
        'UPDATE blog_comments SET comment = $1, posted_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [comment, commentId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
  
      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update comment', message: err.message });
    }
  });
  
  // Delete a Comment by ID
  router.delete('/blogs/comments/:id', async (req, res) => {
    const commentId = req.params.id;
  
    try {
      const result = await pool.query(
        'DELETE FROM blog_comments WHERE id = $1 RETURNING *',
        [commentId]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Comment not found' });
      }
  
      res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete comment', message: err.message });
    }
  });


  

module.exports = router;
