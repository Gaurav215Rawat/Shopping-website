const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const otpLimiter = require('../../middleware/ratelimit');
const { pool } = require('../../config/dbconfig');
const sendMail = require('../../config/mailconfig');
const { error } = require('console');
const bcrypt = require('bcryptjs')


// Generate 6-digit OTP
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// ---------------------- SIGNUP ----------------------
router.post('/signup', async (req, res) => {
  const { name, email, phone, gender } = req.body;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $2',
      [email, phone]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email or phone already registered' });
    }

    const newUser = await client.query(
      `INSERT INTO users (name, email, phone, gender)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, gender, role`,
      [name, email, phone, gender]
    );

    res.status(201).json({ message: 'User created', user: newUser.rows[0] });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error',message:err.detail });
  } finally {
    client.release();
  }
});

// ---------------------- EMAIL CHECK ----------------------
router.post("/mail-verify", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found. Please check the email entered.' });
    }

    return res.status(200).json({ message: 'User found. You can proceed to login.' });
  } catch (error) {
    console.error('Error verifying email:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.detail });
  } finally {
    client.release();
  }
});

// ---------------------- REQUEST OTP ----------------------
router.post('/request-otp', otpLimiter, async (req, res) => {
  const { email } = req.body;

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const now = new Date();
    const lastExpiry = user.otp_expires_at ? new Date(user.otp_expires_at) : null;

    if (lastExpiry && now.getTime() - lastExpiry.getTime() < 60000) {
      return res.status(429).json({ error: 'Please wait before requesting a new OTP.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(now.getTime() + 5 * 60000); // expires in 5 mins

    await client.query(
      `UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3`,
      [otp, expiresAt, email]
    );

    await sendMail(
      email,
      'Your OTP Code',
      `<p>Your OTP code is <b>${otp}</b>. It will expire in 5 minutes.</p>`
    );

    res.json({ message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  } finally {
    client.release();
  }
});

// ---------------------- VERIFY OTP ----------------------
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(user.otp_expires_at);


    if (!user.otp_code || now > expiresAt) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    if (user.otp_code === otp) {
      await client.query(
        `UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE email = $1`,
        [email]
      );

      const payload = { id: user.id, email: user.email, role: user.role };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      return res.json({
        message: 'OTP verified. Logged in successfully.',
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } 
    else {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  } finally {
    client.release();
  }
});

//------------------------------// POST /generate-otp-----------------
// POST /generate-otp
router.post('/get-otp', async (req, res) => {
  try {
    const otp = generateOTP(); 
    const {email} = req.body;
    const saltRounds = 10;

    const hashedOTP = await bcrypt.hash(otp, saltRounds);

    await sendMail(
      email,
      'Your OTP Code',
      `<p>Your OTP code is <b>${otp}</b>. It will expire in 5 minutes.</p>`
    );

    res.status(200).json({
      message: 'OTP generated ',
      hashedOTP: hashedOTP
    });
  } catch (err) {
    console.error('Error generating OTP:', err);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

module.exports = router;
