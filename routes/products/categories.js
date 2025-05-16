const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const path = require('path');
const fs = require('fs');
const uploadcatgImage  = require('../../middleware/uploadcatg');
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');



// utils/buildCategoryTree.js
const buildCategoryTree = (categories, parentId = null) => {
    const tree = [];
  
    categories
      .filter(cat => cat.parent_id === parentId)
      .forEach(cat => {
        const children = buildCategoryTree(categories, cat.id);
        tree.push({
          ...cat,
          subcategories: children
        });
      });
  
    return tree;
  };
  

  

// Create category using name, parent_id, and image_url
router.post('/',authenticateToken,authorizeRoles('Admin'), async (req, res) => {
  const { name, parent_id, image_url } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO categories (name, parent_id, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, parent_id || null, image_url || null]
    );

    res.status(201).json({ message: 'Category created', category: result.rows[0] });
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Internal server error', message: err.detail });
  }
});

// Update category name by ID
router.put('/:id',authenticateToken,authorizeRoles('Admin'), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE categories
       SET name = $1
       WHERE id = $2
       RETURNING *`,
      [name, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json({ message: 'Category name updated', category: result.rows[0] });
  } catch (err) {
    console.error('Error updating category name:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET category (all or by id or name)
router.get('/', async (req, res) => {
  const { id, name } = req.query;

  let query = 'SELECT * FROM categories';
  const values = [];

  if (id) {
    query += ' WHERE id = $1';
    values.push(id);
  } else if (name) {
    query += ' WHERE name = $1';
    values.push(name);
  }

  try {
    const result = await pool.query(query, values);

    const categories = result.rows.map(cat => {
      return {
        ...cat,
        image: cat.image ? `data:image/jpeg;base64,${cat.image.toString('base64')}` : null
      };
    });

    res.json({ categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET categories with pagination and optional full tree
router.get('/v2', async (req, res) => {
    const { page = 1, limit = 10, tree = false } = req.query;
    const offset = (page - 1) * limit;
  
    try {
      if (tree === 'true') {
        const all = await pool.query(`SELECT * FROM categories ORDER BY id`);
        const treeData = buildCategoryTree(all.rows);
        return res.json({ total: all.rowCount, categories: treeData });
      }
  
      const result = await pool.query(
        `SELECT * FROM categories WHERE BY id LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      const total = await pool.query(`SELECT COUNT(*) FROM categories`);
  
      res.json({
        total: parseInt(total.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        categories: result.rows
      });
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// DELETE category
router.delete('/:id',authenticateToken , authorizeRoles('Admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted', category: result.rows[0] });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// PUT endpoint to upload image for a category
router.put('/image/:category_id',authenticateToken,authorizeRoles('Admin'),uploadcatgImage.single('image'), async (req, res) => {
  const { category_id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  try {
    // Fetch existing image path
    const existing = await pool.query(`SELECT image_url FROM categories WHERE id = $1`, [category_id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const existingImageUrl = existing.rows[0].image_url;

    // Delete the existing image file if it exists
    if (existingImageUrl) {
      const fullPath = path.join(__dirname, '..', '..', existingImageUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Construct new image path
    const imagePath = '/' + path.relative(path.join(__dirname, '..', '..'), req.file.path).replace(/\\/g, '/');

    // Update category with new image URL
    const result = await pool.query(
      `UPDATE categories SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [imagePath, category_id]
    );

    res.status(200).json({
      message: 'Category image uploaded successfully',
      category: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to update category image:', err);
    res.status(500).json({ error: 'Failed to update category image', message: err.message });
  }
});

module.exports = router;
