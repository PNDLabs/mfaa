const express = require('express');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

router.use(authMiddleware);
router.use(qrLimiter);

/**
 * Generate a QR code for a given URL.
 * Returns a PNG image inline.
 */
router.get('/qr', async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : null;

  if (!url) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  try {
    const qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(qrBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
