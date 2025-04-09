const express = require('express');
const router = express.Router();
const sendMail = require('../../config/mailconfig'); // Adjust path as per your structure

router.post('/', async (req, res) => {
  const { name, email, phone, inquiry_type, message } = req.body;

  // Validate inputs
  if (!name || !email || !phone || !inquiry_type || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const subject = `New Inquiry: ${inquiry_type}`;
    const html = `
      <h3>New Contact Us Inquiry</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Type:</strong> ${inquiry_type}</p>
      <p><strong>Message:</strong><br/>${message}</p>
    `;

    await sendMail(process.env.CONTACT_RECEIVER_EMAIL, subject, html); // receiver from env

    res.status(200).json({ message: 'Your inquiry has been sent successfully!' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Something went wrong while sending your inquiry.' });
  }
});

module.exports = router;
