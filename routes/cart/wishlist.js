const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const authenticateToken = require('../../middleware/jwt');

// ✅ POST: Add product to wishlist
router.post('/', authenticateToken, async (req, res) => {
  const { user_id, product_id } = req.body;
  const client = await pool.connect();

  try {
    // Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if product exists
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if already in wishlist
    const existing = await client.query(
      'SELECT * FROM wishlists WHERE user_id = $1 AND product_id = $2',
      [user_id, product_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Product already in wishlist" });
    }

    const result = await client.query(
      'INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2) RETURNING *',
      [user_id, product_id]
    );

    res.status(201).json({ message: 'Product added to wishlist', wishlist: result.rows[0] });
  } catch (err) {
    console.error('Error adding to wishlist:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.detail });
  } finally {
    client.release();
  }
});

// ✅ GET: Wishlist items by user_id
router.get('/', authenticateToken, async (req, res) => {
    const { user_id } = req.query;
    const client = await pool.connect();
  
    try {
      // Check if user exists
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Fetch wishlist items with product info and first image
      const result = await client.query(
        `
        SELECT 
          w.id AS wishlist_id,
          p.id AS product_id,
          p.name,
          p.short_description,
          p.price,
          p.discount_price,
          p.stock,
          p.specifications,
          p.category_id,
          c.name AS category_name,
          pi.image_url
        FROM wishlists w
        JOIN products p ON w.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        LEFT JOIN LATERAL (
          SELECT image_url FROM product_images
          WHERE product_id = p.id
          ORDER BY id ASC
          LIMIT 1
        ) pi ON true
        WHERE w.user_id = $1
        `,
        [user_id]
      );

  
      res.json({ wishlist: result.rows });
    } catch (err) {
      console.error('Error fetching wishlist:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.detail });
    } finally {
      client.release();
    }
  });
  

// ✅ DELETE: Remove product from wishlist
router.delete('/', authenticateToken, async (req, res) => {
  const { id } = req.query;
  const client = await pool.connect();

  try {
    const del = await client.query(
      `DELETE FROM wishlists WHERE id = $1 RETURNING *`,
      [id]
    );

    if (del.rows.length === 0) {
      return res.status(404).json({ error: "Item not found in wishlist" });
    }

    res.json({ message: 'Item removed from wishlist', item: del.rows[0] });
  } catch (err) {
    console.error('Error deleting from wishlist:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.detail });
  } finally {
    client.release();
  }
});

module.exports = router;
