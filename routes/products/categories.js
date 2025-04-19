const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
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
  

  

// CREATE category
router.post('/',authenticateToken , authorizeRoles('Admin'), async (req, res) => {
  const { name, parent_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO categories (name, parent_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, parent_id || null]
    );
    res.status(201).json({ message: 'Category created', category: result.rows[0] });
  } catch (err) {
    console.error('Error creating category:', err);
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
    res.json({ categories: result.rows });
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

// UPDATE category
router.put('/:id',authenticateToken , authorizeRoles('Admin'), async (req, res) => {
  const { id } = req.params;
  const { name, parent_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE categories
       SET name = $1, parent_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, parent_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category updated', category: result.rows[0] });
  } catch (err) {
    console.error('Error updating category:', err);
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

module.exports = router;
