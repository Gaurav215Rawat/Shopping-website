const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../../config/dbconfig');

// Verify Razorpay payment
router.post('/verify', async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    order_id
  } = req.body;

  const client = await pool.connect();

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, msg: "Invalid signature" });
    }

    // Begin transaction
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO payments (
        order_id,
        payment_method,
        razorpay_payment_id,
        razorpay_signature,
        payment_status
      ) VALUES ($1, 'razorpay', $2, $3, 'success')
    `, [order_id, razorpay_payment_id, razorpay_signature]);

    await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order_id]);

    // Commit transaction
    await client.query('COMMIT');

    res.json({ success: true, message: "Payment verified" });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Payment verification error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  } finally {
    client.release();
  }
});

// Get payment details by order ID
router.get('/:order_id', async (req, res) => {
  const { order_id } = req.params;
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT * FROM payments WHERE order_id = $1`,
      [order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, msg: "Payment not found" });
    }

    res.json({ success: true, payment: result.rows[0] });

  } catch (err) {
    console.error("Get payment error:", err);
    res.status(500).json({ success: false, msg: "Internal server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
