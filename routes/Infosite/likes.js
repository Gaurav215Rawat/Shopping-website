router.patch('/blogs/:id/like', async (req, res) => {
    const blog_id = req.params.id;
    const user_id = req.body.user_id;
  
    try {
      const existing = await pool.query(
        'SELECT * FROM likes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
        [user_id, 'blog', blog_id]
      );
  
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'User already liked this blog' });
      }
  
      await pool.query('BEGIN');
  
      await pool.query(
        'INSERT INTO likes (user_id, target_type, target_id) VALUES ($1, $2, $3)',
        [user_id, 'blog', blog_id]
      );
  
      const update = await pool.query(
        'UPDATE blogs SET likes = likes + 1 WHERE id = $1 RETURNING likes',
        [blog_id]
      );
  
      await pool.query('COMMIT');
  
      res.status(200).json({ message: 'Blog liked', likes: update.rows[0].likes });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Failed to like blog', message: err.message });
    }
  });
  