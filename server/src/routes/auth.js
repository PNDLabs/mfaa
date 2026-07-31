const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Strict rate limit for login: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const storedPassword = process.env.ACCESS_PASSWORD;
  const storedHash = process.env.ACCESS_PASSWORD_HASH;

  let isValid = false;

  if (storedHash) {
    // Compare against bcrypt hash
    isValid = await bcrypt.compare(password, storedHash);
  } else if (storedPassword) {
    // Compare against plain-text password
    isValid = password === storedPassword;
  } else {
    return res.status(500).json({ error: 'Server not configured: no password set' });
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ authenticated: true }, process.env.JWT_SECRET, {
    expiresIn: process.env.TOKEN_EXPIRY || '24h',
  });

  res.json({ token });
});

module.exports = router;
