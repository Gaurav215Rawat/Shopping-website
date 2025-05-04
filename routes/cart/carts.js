const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const authenticateToken = require('../../middleware/jwt');

// ✅ GET cart details by user_id
router.get('/', authenticateToken, async (req, res) => {
  const { userid } = req.query;
  const client = await pool.connect();

  try {
    const user = await client.query('SELECT name, id FROM users WHERE id = $1', [userid]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await client.query('SELECT * FROM carts WHERE user_id = $1', [userid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cart not found for the user' });
    }

    res.json({ cart: result.rows });
  } catch (err) {
    console.error('Error getting cart details:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.detail });
  } finally {
    client.release();
  }
});


// ✅ POST API to create cart for a user (Admin only)
router.post('/', authenticateToken, async (req, res) => {
  const { user_id } = req.body;
  const client = await pool.connect();

  try {
    const user = await client.query('SELECT name, id FROM users WHERE id = $1', [user_id]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if cart already exists for this user
    const existingCart = await client.query('SELECT * FROM carts WHERE user_id = $1', [user_id]);
    if (existingCart.rows.length > 0) {
      return res.status(400).json({ error: "Cart already exists for this user" });
    }

    const insertCart = await client.query(
      'INSERT INTO carts (user_id) VALUES ($1) RETURNING *',
      [user_id]
    );

    res.status(201).json({ message: 'Cart created successfully', cart: insertCart.rows[0] });

  } catch (err) {
    console.error('Error creating cart:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.detail });
  } finally {
    client.release();
  }
});



// ✅ GET items by user_id (with user & cart check)
router.get('/items', authenticateToken, async (req, res) => {
    const { user_id } = req.query;
  
    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }
  
    const client = await pool.connect();
    try {
      // Check if user exists
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [user_id]
      );
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Check if cart exists for user
      const cartCheck = await client.query(
        'SELECT id FROM carts WHERE user_id = $1',
        [user_id]
      );
      if (cartCheck.rows.length === 0) {
        return res.status(404).json({ error: "Cart not found for the user" });
      }
  
      const cartId = cartCheck.rows[0].id;
  
      // Get items in the user's cart
      const result = await client.query(
        ` SELECT 
        ci.*, 
        p.name AS product_name,
        p.discount_price,
        c.name AS category_name,
        (
          SELECT image_url 
          FROM product_images pi 
          WHERE pi.product_id = p.id 
          LIMIT 1
        ) AS image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ci.cart_id = $1
      `,
      [cartId]
    );
  
    const items = result.rows;
    const total_products = items.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({
      cart_id: cartId,
      total_products,
      items
    });
    } catch (err) {
      console.error('Error fetching cart items:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.detail });
    } finally {
      client.release();
    }
  });
  
  
  
// ✅ POST: Add item to cart
router.post('/items', authenticateToken, async (req, res) => {
  const { user_id, product_id, quantity } = req.body;
  const client = await pool.connect();

  try {
    // Check if user exists
    const userCheck = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if cart exists for user
    const cartCheck = await client.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [user_id]
    );
    if (cartCheck.rows.length === 0) {
      return res.status(404).json({ error: "Cart not found for the user" });
    }

    const { id: cart_id } = cartCheck.rows[0];

    // Check if item already exists
    const existing = await client.query(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cart_id, product_id]
    );

    if (existing.rows.length > 0) {
      // Increase quantity by 1
      const updated = await client.query(
        `UPDATE cart_items
         SET quantity = quantity + 1
         WHERE cart_id = $1 AND product_id = $2
         RETURNING *`,
        [cart_id, product_id]
      );
      return res.status(200).json({ message: "Product quantity increased", item: updated.rows[0] });
    }

    // Insert new item
    const insert = await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity) 
       VALUES ($1, $2, $3) RETURNING *`,
      [cart_id, product_id, quantity || 1]
    );

    res.status(201).json({ message: 'Product added to cart', item: insert.rows[0] });
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.detail });
  } finally {
    client.release();
  }
});

  
  
  
  // ✅ PUT: Update quantity or remove item if quantity is 0
router.put('/items', authenticateToken, async (req, res) => {
    const { user_id, product_id, quantity } = req.body;
    const client = await pool.connect();
  
    try {
      // Validate user
      const user = await client.query('SELECT id FROM users WHERE id = $1', [user_id]);
      if (user.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Validate cart
      const cart = await client.query('SELECT id FROM carts WHERE user_id = $1', [user_id]);
      if (cart.rows.length === 0) {
        return res.status(404).json({ error: "Cart not found for user" });
      }
  
      const { id: cart_id } = cart.rows[0];
  
      if (quantity === 0) {
        // Delete item from cart
        const del = await client.query(
          `DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING *`,
          [cart_id, product_id]
        );
  
        if (del.rows.length === 0) {
          return res.status(404).json({ error: "Item not found in cart" });
        }
  
        return res.json({ message: 'Item removed from cart due to zero quantity', item: del.rows[0] });
      }
  
      // Update quantity
      const update = await client.query(
        `UPDATE cart_items SET quantity = $1 
         WHERE cart_id = $2 AND product_id = $3 RETURNING *`,
        [quantity, cart_id, product_id]
      );
  
      if (update.rows.length === 0) {
        return res.status(404).json({ error: "Item not found in cart" });
      }
  
      res.json({ message: 'Quantity updated', item: update.rows[0] });
    } catch (err) {
      console.error('Error updating quantity:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.detail });
    } finally {
      client.release();
    }
  });
  
  
  
  
// ✅ DELETE: Remove item from cart by cart_item id
router.delete('/items', authenticateToken, async (req, res) => {
    const { id } = req.query; // id from cart_items
    const client = await pool.connect();
  
    try {
      const del = await client.query(
        `DELETE FROM cart_items WHERE id = $1 RETURNING *`,
        [id]
      );
  
      if (del.rows.length === 0) {
        return res.status(404).json({ error: "Cart item not found" });
      }
  
      res.json({ message: 'Item removed from cart', item: del.rows[0] });
    } catch (err) {
      console.error('Error removing item from cart:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.detail });
    } finally {
      client.release();
    }
  });

module.exports = router;
