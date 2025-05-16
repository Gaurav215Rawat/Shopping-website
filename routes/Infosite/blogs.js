const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const path = require('path');
const fs = require('fs');
const uploadBlogImage  = require('../../middleware/uploadBlogImage');
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');

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
    console.log(req.query); // Check query parameters
    const result = await pool.query('SELECT DISTINCT category FROM blogs');
    res.json(result.rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});
// ======================================================
// 🔹 3. GET Blog by ID
// ======================================================
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id; // assuming authenticateToken sets req.user

  try {
    const blogResult = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);

    if (blogResult.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const likeResult = await pool.query(
      `SELECT 1 FROM likes 
       WHERE user_id = $1 AND target_type = 'blog' AND target_id = $2`,
      [userId, id]
    );

    const isLiked = likeResult.rows.length > 0;

    res.json({ ...blogResult.rows[0], is_liked: isLiked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ======================================================
// 🔹 4. POST New Blog
// ======================================================
router.post('/',authenticateToken,authorizeRoles('Admin'), async (req, res) => {
  const {
    blogTitle, blogDescription, blogCategory,
    author, blogContent,
    estimated_read_time, url_reference
  } = req.body;

  // Ensure the content is properly structured as JSON
  const content = JSON.stringify(blogContent);  // Convert blogContent to JSON string if not already

  try {
    const result = await pool.query(`
      INSERT INTO blogs 
      (title, url_reference, summary, content, category, author, estimated_read_time) 
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      RETURNING *
    `, [
      blogTitle, url_reference, blogDescription, content, 
      blogCategory, author, estimated_read_time
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

router.delete('/:id',authenticateToken,authorizeRoles('Admin'), async (req, res) => {
  const { id } = req.params;

  try {
    // Get the blog and its image_url
    const existing = await pool.query('SELECT image_url FROM blogs WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const imagePath = existing.rows[0].image_url;

    // Delete the folder if imagePath exists
    if (imagePath) {
      const fullPath = path.join(__dirname, '..', '..', imagePath);
      const folderPath = path.dirname(fullPath);

      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
    }

    // Delete the blog from the database
    const result = await pool.query('DELETE FROM blogs WHERE id = $1 RETURNING *', [id]);

    res.status(200).json({ message: 'Blog deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});


// ======================================================
// 🔹 5.0 Update a blog's details
// ======================================================
router.patch('/blogs/:id',authenticateToken,authorizeRoles('Admin'), async (req, res) => {
  const blog_id = req.params.id;
  const {
    blogTitle,
    url_reference,
    blogDescription,
    blogContent,
    blogCategory,
    tags,
    author,
    thumbnail_url,
    estimated_read_time,
    likes
  } = req.body;

  try {
    // Check if the blog exists
    const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [blog_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Update query
    const updateQuery = `
      UPDATE blogs
      SET
        title = COALESCE($1, title),
        url_reference = COALESCE($2, url_reference),
        summary = COALESCE($3, summary),
        content = COALESCE($4::jsonb, content),
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
      blogTitle,
      url_reference,
      blogDescription,
      blogContent,
      blogCategory,
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




/// image
// PUT endpoint to upload image for a blog
router.put('/image/:blog_id',authenticateToken,authorizeRoles('Admin'), uploadBlogImage.single('image'), async (req, res) => {
  const { blog_id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  try {
    // Fetch existing image path
    const existing = await pool.query(`SELECT image_url FROM blogs WHERE id = $1`, [blog_id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    const existingImageUrl = existing.rows[0].image_url;

    // Delete the existing image file if it exists and is not empty
    if (existingImageUrl) {
      const fullPath = path.join(__dirname, '..', '..', existingImageUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Construct new image path
    const imagePath = '/' + path.relative(path.join(__dirname, '..', '..'), req.file.path).replace(/\\/g, '/');

    // Update blog with new image URL
    const result = await pool.query(
      `UPDATE blogs SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [imagePath, blog_id]
    );

    res.status(200).json({
      message: 'Blog image uploaded successfully',
      blog: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to update blog image:', err);
    res.status(500).json({ error: 'Failed to update blog image', message: err.message });
  }
});


module.exports = router;
