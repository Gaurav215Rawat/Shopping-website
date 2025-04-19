const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ✅ Create Order & Razorpay Order
router.post('/checkout', async (req, res) => {
  const { user_id, address_id, items, total } = req.body;
  const client = await pool.connect();

  try {
    // 1. Create Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: 'INR',
      receipt: `order_rcptid_${Date.now()}`
    });

    await client.query('BEGIN');

    // 2. Insert into orders table
    const orderResult = await client.query(`
      INSERT INTO orders (user_id, address_id, total, razorpay_order_id)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, address_id, total, razorpayOrder.id]
    );

    const order = orderResult.rows[0];

    // 3. Insert items into order_items
    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      order,
      razorpay_order_id: razorpayOrder.id
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Checkout Error:", err);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
});


// ✅ Get All Orders of User
router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT * FROM orders
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [user_id]
    );

    res.json({ success: true, orders: result.rows });

  } catch (err) {
    console.error("Get User Orders Error:", err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  } finally {
    client.release();
  }
});


// ✅ Get Single Order with Items
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const order = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const items = await client.query(`SELECT * FROM order_items WHERE order_id = $1`, [id]);

    res.json({
      success: true,
      order: order.rows[0],
      items: items.rows
    });

  } catch (err) {
    console.error("Get Single Order Error:", err);
    res.status(500).json({ error: 'Failed to fetch order' });
  } finally {
    client.release();
  }
});


// ✅ Update Order Status
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const client = await pool.connect();

  try {
    await client.query(`UPDATE orders SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ success: true });

  } catch (err) {
    console.error("Update Order Status Error:", err);
    res.status(500).json({ error: 'Failed to update order status' });
  } finally {
    client.release();
  }
});


// ❌ Delete an Order (optional)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
    await client.query(`DELETE FROM orders WHERE id = $1`, [id]);
    await client.query('COMMIT');

    res.json({ success: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Delete Order Error:", err);
    res.status(500).json({ error: 'Failed to delete order' });
  } finally {
    client.release();
  }
});

module.exports = router;
