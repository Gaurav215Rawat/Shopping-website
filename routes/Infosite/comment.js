const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');
// ======================================================
// 🔹 1. POST Comment on a Blog
// ======================================================
router.post('/:id',authenticateToken, async (req, res) => {
  const blog_id = req.params.id;
  const { user_id, comment } = req.body; // Added user_id

  try {
    const result = await pool.query(`
      INSERT INTO blog_comments (blog_id, user_id, comment) 
      VALUES ($1, $2, $3)
      RETURNING *
    `, [blog_id, user_id, comment]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment', message: err.detail });
  }
});

// ======================================================
// 🔹 2. GET Comments for a Blog
// ======================================================
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // Fetch comments with is_liked flag and user name
    const commentsResult = await pool.query(
      `SELECT 
         bc.id,
         bc.blog_id,
         bc.user_id,
         u.name AS user_name,
         bc.comment,
         bc.likes,
         bc.posted_at,
         CASE 
           WHEN l.user_id IS NOT NULL THEN true
           ELSE false
         END AS is_liked
       FROM blog_comments bc
       JOIN users u ON bc.user_id = u.id
       LEFT JOIN likes l 
         ON l.user_id = $1 
         AND l.target_type = 'comment' 
         AND l.target_id = bc.id
       WHERE bc.blog_id = $2
       ORDER BY bc.posted_at ASC`,
      [userId, id]
    );

    // Safely log is_liked if at least one comment exists
    if (commentsResult.rows.length > 0) {
      console.log(commentsResult.rows[0].is_liked);
    } else {
      console.log('No comments found');
    }

    // Count total comments
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total_comments FROM blog_comments WHERE blog_id = $1`,
      [id]
    );

    res.json({
      total_comments: parseInt(countResult.rows[0].total_comments, 10),
      comments: commentsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments', message: err.message });
  }
});






// ======================================================
// 🔹 3. Update Comment Text Only
// ======================================================
router.patch('/:id', authenticateToken, async (req, res) => {
  const commentId = req.params.id;
  const { comment } = req.body;
  const loggedInUserId = req.user.id; // Assuming authenticateToken sets req.user

  try {
    // Check if the comment exists and belongs to the user
    const checkResult = await pool.query(
      'SELECT user_id FROM blog_comments WHERE id = $1',
      [commentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const commentOwnerId = checkResult.rows[0].user_id;

    if (commentOwnerId !== loggedInUserId) {
      return res.status(403).json({ error: 'Unauthorized to edit this comment' });
    }

    // Perform the update
    const result = await pool.query(
      'UPDATE blog_comments SET comment = $1, posted_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [comment, commentId]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update comment', message: err.message });
  }
});


// ======================================================
// 🔹 4. Delete a Comment by ID
// ======================================================
router.delete('/:id', authenticateToken, async (req, res) => {
  const commentId = req.params.id;
  const loggedInUserId = req.user.id;
  const userRole = req.user.role; // assuming this is set by authenticateToken

  try {
    // Check if the comment exists and get the owner
    const commentResult = await pool.query(
      'SELECT user_id FROM blog_comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const commentOwnerId = commentResult.rows[0].user_id;

    // Check if user is the owner or an Admin
    if (commentOwnerId !== loggedInUserId || userRole !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    // Delete the comment
    await pool.query('DELETE FROM blog_comments WHERE id = $1', [commentId]);

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment', message: err.message });
  }
});

module.exports = router;
