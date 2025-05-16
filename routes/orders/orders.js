const express = require('express');
const router = express.Router();
const sendMail = require('../../config/mailconfig');
const { pool } = require('../../config/dbconfig');
const { v4: uuidv4 } = require('uuid'); // Use uuid to generate unique transactionId
const authenticateToken =require('../../middleware/jwt')
const authorizeRoles = require('../../middleware/authorizeRole');

const axios = require('axios'); // Import axios to call internal APIs

// ✅ Create Order (PhonePe or COD)
router.post('/checkout',authenticateToken, async (req, res) => {
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
          // ✅ Send Email
          await sendMail(
            req.user.email,
            'Order Initiated - PhonePe Payment',
            `<h2>Thank you for your order!</h2>
            <p>Your order ID: <strong>${order_id}</strong></p>
            <p>Please complete your payment using the PhonePe link below:</p>
            <a href="${paymentResponse.data.phonePeUrl}">Pay Now</a>`
          );

          res.json({
            success: true,
            order,
            phonePeUrl: paymentResponse.data.phonePeUrl
          });
} else {
        res.status(500).json({ success: false, message: 'Failed to create payment' });
      }
    } 
    
    
    else if (payment_method === 'cod') {
      // 7. Handle COD payment method - no need for external payment API
      await client.query(`
        INSERT INTO payments (transaction_id, user_id, payment_status,order_id)
        VALUES ($1, $2, $3, $4)`,
        [phonepe_order_id, user_id, 'pending',order.id] // 'pending' for COD status
      );

      await sendMail(
          req.user.email,
          'Order Confirmed - Cash on Delivery',
          `<h2>Your order has been placed!</h2>
          <p>Order ID: <strong>${order_id}</strong></p>
          <p>We will deliver your order soon. Please keep the payment ready.</p>`
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
router.get('/user/:user_id',authenticateToken, async (req, res) => {
  const { user_id } = req.params;
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        o.id AS order_id,
        o.status,
        o.total,
        o.payment_method,
        o.created_at,
        json_agg(
          json_build_object(
            'product_id', p.id,
            'name', p.name,
            'discount_price', p.discount_price,
            'quantity', oi.quantity,
            'price', oi.price,
            'stock', p.stock,
            'image', pi.image_url,
            'rating', r.rating
          )
        ) AS items
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, image_url
        FROM product_images
        ORDER BY product_id, id
      ) pi ON pi.product_id = p.id
      LEFT JOIN reviews r 
        ON r.product_id = p.id AND r.user_id = o.user_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [user_id]);

    res.json({ success: true, orders: result.rows });
  } catch (err) {
    console.error("Get User Orders Error:", err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  } finally {
    client.release();
  }
});



// ✅ Get Single Order with Items
router.get('/:id',authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // Get order with address details
    const orderResult = await client.query(`
      SELECT 
        o.*, 
        a.full_name, 
        a.phone_no, 
        a.address_line, 
        a.city, 
        a.state, 
        a.country, 
        a.postal_code 
      FROM orders o
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.id = $1
    `, [id]);

    const order = orderResult.rows[0];

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get order items with product details and one image
    const itemsResult = await client.query(`
      SELECT 
        oi.product_id,
        p.name,
        p.discount_price,
        p.stock,
        oi.quantity,
        oi.price,
        pi.image_url,
        r.rating  -- rating can be NULL if no review
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, image_url
        FROM product_images
        ORDER BY product_id, id
      ) pi ON pi.product_id = p.id
      LEFT JOIN reviews r 
        ON r.product_id = oi.product_id AND r.user_id = (
          SELECT user_id FROM orders WHERE id = $1
        )
      WHERE oi.order_id = $1
    `, [id]);

    // Structure the response
    const { full_name, phone_no, address_line, city, state, country, postal_code, ...orderData } = order;

    res.json({
      success: true,
      order: orderData,
      address: {
        full_name,
        phone_no,
        address_line,
        city,
        state,
        country,
        postal_code
      },
      items: itemsResult.rows
    });
  } catch (err) {
    console.error("Get Order Error:", err);
    res.status(500).json({ error: 'Failed to fetch order' });
  } finally {
    client.release();
  }
});




router.get('/',authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      status,
      payment_method,
      start_date,
      end_date,
      page = 1,
      limit = 10
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let values = [];

    if (name) {
      values.push(`%${name.toLowerCase()}%`);
      conditions.push(`LOWER(u.name) LIKE $${values.length}`);
    }

    if (status) {
      values.push(status.toLowerCase());
      conditions.push(`LOWER(o.status) = $${values.length}`);
    }

    if (payment_method) {
      values.push(payment_method.toLowerCase());
      conditions.push(`LOWER(o.payment_method) = $${values.length}`);
    }

    if (start_date) {
      values.push(start_date);
      conditions.push(`o.created_at >= $${values.length}`);
    }

    if (end_date) {
      values.push(end_date);
      conditions.push(`o.created_at <= $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Log generated query and values
    console.log("Where Clause:", whereClause);
    console.log("Values:", values);

    // Total count
    const countResult = await client.query(
      `SELECT COUNT(DISTINCT o.id) AS total
       FROM orders o
       JOIN users u ON o.user_id = u.id
       JOIN order_items oi ON o.id = oi.order_id
       ${whereClause}`,
      values
    );
    const totalOrders = parseInt(countResult.rows[0].total, 10);

    // Fetch orders with item and user details
    values.push(limit, offset);
    const result = await client.query(
      `SELECT 
        o.id AS order_id,
        o.status,
        o.total,
        o.payment_method,
        o.created_at,
        u.name,
        json_agg(
          json_build_object(
            'product_id', p.id,
            'name', p.name,
            'discount_price', p.discount_price,
            'stock', p.stock,
            'quantity', oi.quantity,
            'price', oi.price,
            'image', pi.image_url
          )
        ) AS items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, image_url
        FROM product_images
        ORDER BY product_id, id
      ) pi ON pi.product_id = p.id
      ${whereClause}
      GROUP BY o.id, u.name
      ORDER BY o.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    // Log the final query result
    console.log("Orders:", result.rows);

    const orders = result.rows.map(order => ({
      ...order,
      name: order.name
    }));

    res.json({
      success: true,
      totalOrders,
      ordersLeft: totalOrders - page * limit > 0 ? totalOrders - page * limit : 0,
      orders
    });

  } catch (err) {
    console.error("Get Orders Error:", err); // Log the actual error
    res.status(500).json({ error: 'Failed to fetch orders' });
  } finally {
    client.release();
  }
});



// ✅ Delete an Order
router.delete('/:id',authenticateToken, async (req, res) => {
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




// API that allows changing the status of an order
router.put('/status/:order_id',authenticateToken,authorizeRoles('Admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_id } = req.params; // Get the order_id from URL parameter
    const { status } = req.body; // Get the new status from request body

    // Validate the new status
    const validStatuses = ['initiated','shipped', 'delivered', 'canceled', 'return'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status provided' });
    }

    // Check the current status of the order
    const orderResult = await client.query(
      `SELECT status FROM orders WHERE id = $1`,
      [order_id]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = orderResult.rows[0].status;

    // Define valid transitions for each status
    const validTransitions = {
      'initiated': ['shipped', 'delivered', 'canceled'],
      'shipped': ['delivered', 'canceled'],
      'delivered': ['return'],
      'canceled': [],
      'return': [] // After 'return', no further status can be set.
    };

    // Check if the status transition is valid
    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition: '${currentStatus}' to '${status}' is not allowed`
      });
    }

    // Update the order status in the database
    const result = await client.query(
      `UPDATE orders 
       SET status = $1 
       WHERE id = $2 
       RETURNING id, status, created_at, user_id`, 
      [status, order_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = result.rows[0];
    
    // ✅ Fetch user's email
        const userEmailResult = await client.query(
          `SELECT email FROM users WHERE id = $1`,
          [updatedOrder.user_id]
        );

        const userEmail = userEmailResult.rows[0]?.email;

    /// ✅ Send notification email if email exists
          if (userEmail) {
            await sendMail(
              userEmail,
              `Order Status Updated to '${updatedOrder.status}'`,
              `<h2>Order Status Update</h2>
              <p>Your order <strong>${updatedOrder.id}</strong> status has been changed to <strong>${updatedOrder.status}</strong>.</p>`
            );
          }

          // ✅ Return JSON response
          res.json({
            success: true,
            message: 'Order status updated successfully',
            order: {
              order_id: updatedOrder.id,
              status: updatedOrder.status,
              created_at: updatedOrder.created_at,
              user_id: updatedOrder.user_id
            }
          });

  } catch (err) {
    console.error("Update Order Status Error:", err);
    res.status(500).json({ error: 'Failed to update order status' });
  } finally {
    client.release();
  }
});


module.exports = router;
