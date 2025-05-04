const express = require('express');
const router = express.Router();
const { pool } = require('../../config/dbconfig');
const { v4: uuidv4 } = require('uuid'); // Use uuid to generate unique transactionId


const axios = require('axios'); // Import axios to call internal APIs

// ✅ Create Order (PhonePe or COD)
router.post('/checkout', async (req, res) => {
  const { user_id, address_id, items, total, payment_method } = req.body; // payment_method can be 'phonepe' or 'cod'

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Generate a unique transaction ID
    const order_id = 'ORD_' + uuidv4(); // Order ID format like ORD_12345...

    // 2. Insert Order into the database with payment status 'initiated' (PhonePe or COD)
    const orderResult = await client.query(`
      INSERT INTO orders (user_id, address_id, total, payment_method, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, address_id, total, payment_method, 'initiated']
    );

    const order = orderResult.rows[0];

    // 3. Insert Items into Order Items table
    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
    }

    // 4. Insert Payment record into Payments table
    let phonepe_order_id = null;
    if (payment_method === 'phonepe') {
      phonepe_order_id = 'TXN_' + uuidv4(); // Generate a PhonePe order ID
      await client.query(`
        INSERT INTO payments (transaction_id, user_id, payment_status,order_id)
        VALUES ($1, $2, $3, $4)`,
        [phonepe_order_id, user_id, 'initiated',order.id,]
      );

      // 5. Call the /payment API to initiate PhonePe payment
      const paymentResponse = await axios.post('http://localhost:3002/api/payment', {
        transactionId: phonepe_order_id,
        MUID: user_id.toString(),
        name: req.body.name,
        number: req.body.number,
        amount: total
      });

      // 6. Handle the response and redirect to PhonePe Payment URL
      if (paymentResponse.data.success) {
        res.json({
          success: true,
          order,
          phonePeUrl: paymentResponse.data.phonePeUrl
        });
      } else {
        res.status(500).json({ success: false, message: 'Failed to create payment' });
      }
    } else if (payment_method === 'cod') {
      // 7. Handle COD payment method - no need for external payment API
      await client.query(`
        INSERT INTO payments (transaction_id, user_id, payment_status,order_id)
        VALUES ($1, $2, $3, $4)`,
        [phonepe_order_id, user_id, 'pending',order.id] // 'pending' for COD status
      );

      res.json({
        success: true,
        message: 'Order created successfully, awaiting Cash on Delivery payment.',
        order
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Checkout Error:", err);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
});




// ✅ Get All Orders for a User
router.get('/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
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
    console.error("Get Order Error:", err);
    res.status(500).json({ error: 'Failed to fetch order' });
  } finally {
    client.release();
  }
});


// ✅ Update Order Status (e.g., from PhonePe webhook)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2`,
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ error: 'Failed to update order status' });
  } finally {
    client.release();
  }
});


// ✅ Delete an Order
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



router.post('/phonepe/webhook', async (req, res) => {
  const { transactionId, orderId, status } = req.body; // depends on PhonePe payload

  try {
    await pool.query(
      `UPDATE orders SET status = $1 WHERE phonepe_order_id = $2`,
      [status.toLowerCase(), orderId]
    );
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("PhonePe Webhook Error:", err);
    res.status(500).json({ error: 'Failed to update order from webhook' });
  }
});


module.exports = router;
