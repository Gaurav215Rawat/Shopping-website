const rateLimit = require("express-rate-limit");

// Limit OTP requests: max 10 per 15 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OTP requests
  message: {
    error: 'Too many OTP requests, please try again after 15 minutes.'
  },
  keyGenerator: (req) => req.body.email || req.ip,
});


module.exports = otpLimiter;