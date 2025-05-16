const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const authenticateToken = require('../../middleware/jwt');


router.post('/:id', authenticateToken, async (req, res) => {
  const targetId = req.params.id;
  const userId = req.user.id;
  const { target_type } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, target_type, targetId]
    );

    await pool.query('BEGIN');

    if (existing.rows.length > 0) {
      // Unlike logic
      await pool.query(
        'DELETE FROM likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
        [userId, target_type, targetId]
      );

      let update;
      if (target_type === 'blog') {
        update = await pool.query(
          'UPDATE blogs SET likes = GREATEST(likes - 1, 0) WHERE id = $1 RETURNING likes',
          [targetId]
        );
      } else if (target_type === 'comment') {
        update = await pool.query(
          'UPDATE blog_comments SET likes = GREATEST(likes - 1, 0) WHERE id = $1 RETURNING likes',
          [targetId]
        );
      } else {
        return res.status(400).json({ message: 'Invalid target type' });
      }

      await pool.query('COMMIT');
      return res.status(200).json({ message: 'Like removed', likes: update.rows[0].likes });
    }

    // Like logic
    await pool.query(
      'INSERT INTO likes (user_id, target_type, target_id) VALUES ($1, $2, $3)',
      [userId, target_type, targetId]
    );

    let update;
    if (target_type === 'blog') {
      update = await pool.query(
        'UPDATE blogs SET likes = likes + 1 WHERE id = $1 RETURNING likes',
        [targetId]
      );
    } else if (target_type === 'comment') {
      update = await pool.query(
        'UPDATE blog_comments SET likes = likes + 1 WHERE id = $1 RETURNING likes',
        [targetId]
      );
    } else {
      return res.status(400).json({ message: 'Invalid target type' });
    }

    await pool.query('COMMIT');
    res.status(200).json({ message: 'Like added', likes: update.rows[0].likes });

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to process like', message: err.message });
  }
});

  

  
module.exports = router;