const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');


// ======================================================
// 🔹 1. GET All Blogs (Optional: Filter by Category)
// ======================================================
router.get('/', async (req, res) => {
  const { category } = req.query;

  try {
    const query = category
      ? 'SELECT * FROM blogs WHERE category = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM blogs ORDER BY created_at DESC';
    const values = category ? [category] : [];

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ======================================================
// 🔹 2. GET Unique Categories
// ======================================================
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM blogs');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ======================================================
// 🔹 3. GET Blog by ID
// ======================================================
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
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

// ======================================================
// 🔹 4. POST New Blog
// ======================================================
router.post('/', async (req, res) => {
  const {
    title, url_reference, summary, content,
    category, tags, author, thumbnail_url,
    estimated_read_time
  } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO blogs 
      (title, url_reference, summary, content, category, tags, author, thumbnail_url, estimated_read_time) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      title, url_reference, summary, content,
      category, tags, author, thumbnail_url,
      estimated_read_time
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create blog', message: err.detail });
  }
});

// ======================================================
// 🔹 5. DELETE Blog by ID
// ======================================================
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
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

// ======================================================
// 🔹 5.0 Update a blog's details
// ======================================================
router.patch('/blogs/:id', async (req, res) => {
  const blog_id = req.params.id;
  const {
    title,
    url_reference,
    summary,
    content,
    category,
    tags,
    author,
    thumbnail_url,
    estimated_read_time,
    likes
  } = req.body;

  try {
    // Fetch the current data for the blog to ensure it's valid
    const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [blog_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Prepare the update query with the new values
    const updateQuery = `
      UPDATE blogs
      SET
        title = COALESCE($1, title),
        url_reference = COALESCE($2, url_reference),
        summary = COALESCE($3, summary),
        content = COALESCE($4, content),
        category = COALESCE($5, category),
        tags = COALESCE($6, tags),
        author = COALESCE($7, author),
        thumbnail_url = COALESCE($8, thumbnail_url),
        estimated_read_time = COALESCE($9, estimated_read_time),
        likes = COALESCE($10, likes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `;

    const updatedBlog = await pool.query(updateQuery, [
      title, 
      url_reference, 
      summary, 
      content, 
      category, 
      tags, 
      author, 
      thumbnail_url, 
      estimated_read_time, 
      likes,
      blog_id
    ]);

    res.status(200).json(updatedBlog.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update blog', message: err.message });
  }
});

// ======================================================
// 🔹 5.1. PATCH - Update the like count for a blog
// ======================================================
router.patch('/blogslike/:id', async (req, res) => {
  const blog_id = req.params.id;

  try {
    // Get the current like count
    const result = await pool.query('SELECT likes FROM blogs WHERE id = $1', [blog_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    let currentLikes = result.rows[0].likes;

    // Increment the like count
    currentLikes += 1;

    // Update the blog with the new like count
    await pool.query(
      'UPDATE blogs SET likes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [currentLikes, blog_id]
    );

    res.status(200).json({ message: 'Blog like count updated successfully', likes: currentLikes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update blog like count', message: err.message });
  }
});




module.exports = router;
