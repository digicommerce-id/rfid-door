const express = require('express');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { sendTelegramMessage } = require('../telegram');

const router = express.Router();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper to format date
const formatDate = (date) => {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }).format(date);
};

// POST /api/rfid/verify
router.post('/verify', async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({
      authorized: false,
      message: 'UID is required'
    });
  }

  try {
    // Cari kartu berdasarkan UID
    const card = await prisma.card.findUnique({
      where: { uid: uid },
      include: { user: true }
    });

    const now = new Date();
    const formattedDate = formatDate(now);

    // Skenario B: Kartu Tidak Dikenal
    if (!card) {
      await prisma.accessLog.create({
        data: {
          cardUid: uid,
          status: 'FAILED_UNKNOWN_CARD',
        }
      });

      const message = `⚠️ PERINGATAN KEAMANAN: Percobaan masuk ilegal terdeteksi! Kartu Tidak Dikenal (UID: ${uid}) mencoba membuka pintu pada ${formattedDate} WIB.`;
      await sendTelegramMessage(message);

      return res.status(401).json({
        authorized: false,
        message: 'Access denied. Card not recognized.'
      });
    }

    // Skenario B: Kartu Dikenal tapi Non-aktif (Blocked/Inactive)
    if (card.status !== 'ACTIVE') {
      await prisma.accessLog.create({
        data: {
          cardUid: uid,
          status: 'FAILED_INACTIVE_CARD',
        }
      });

      const message = `⚠️ PERINGATAN KEAMANAN: Akses ditolak! Kartu (UID: ${uid}) milik ${card.user.name} berstatus ${card.status} mencoba membuka pintu pada ${formattedDate} WIB.`;
      await sendTelegramMessage(message);

      return res.status(401).json({
        authorized: false,
        message: 'Access denied. Card is inactive or blocked.'
      });
    }

    // Skenario A: Akses Diberikan
    await prisma.accessLog.create({
      data: {
        cardUid: uid,
        status: 'SUCCESS',
      }
    });

    const successMessage = `✅ AKSES DIBERIKAN: Pintu Utama dibuka oleh ${card.user.name} [${card.user.role}] pada ${formattedDate} WIB.`;
    await sendTelegramMessage(successMessage);

    return res.status(200).json({
      authorized: true,
      message: 'Access granted',
      user: card.user.name
    });

  } catch (error) {
    console.error('Error verifying RFID:', error);
    return res.status(500).json({
      authorized: false,
      message: 'Internal server error'
    });
  }
});

// Endpoint verifikasi Sidik Jari
router.post('/fingerprint/verify', async (req, res) => {
  const { fingerId } = req.body;

  if (fingerId === undefined) {
    return res.status(400).json({ error: 'fingerId is required' });
  }

  try {
    // Cari sidik jari berdasarkan fingerId
    const fingerprint = await prisma.fingerprint.findUnique({
      where: { fingerId: parseInt(fingerId) },
      include: { user: true }
    });

    const now = new Date();
    const formattedDate = formatDate(now);

    // Skenario B: Sidik Jari Tidak Dikenal
    if (!fingerprint) {
      await prisma.accessLog.create({
        data: {
          credentialId: `FINGER_${fingerId}`,
          status: 'FAILED_UNKNOWN_CARD', // Reuse status for simplicity
        }
      });

      const message = `⚠️ PERINGATAN KEAMANAN: Percobaan masuk ilegal terdeteksi! Sidik Jari Tidak Dikenal (ID: ${fingerId}) mencoba membuka pintu pada ${formattedDate} WIB.`;
      await sendTelegramMessage(message);

      return res.status(401).json({
        authorized: false,
        message: 'Access denied. Fingerprint not recognized.'
      });
    }

    // Skenario B: Sidik Jari Dikenal tapi Non-aktif
    if (fingerprint.status !== 'ACTIVE') {
      await prisma.accessLog.create({
        data: {
          credentialId: `FINGER_${fingerId}`,
          status: 'FAILED_INACTIVE_CARD',
        }
      });

      const message = `⚠️ PERINGATAN KEAMANAN: Akses ditolak! Sidik Jari (ID: ${fingerId}) milik ${fingerprint.user.name} berstatus ${fingerprint.status} mencoba membuka pintu pada ${formattedDate} WIB.`;
      await sendTelegramMessage(message);

      return res.status(401).json({
        authorized: false,
        message: 'Access denied. Fingerprint is inactive or blocked.'
      });
    }

    // Skenario A: Akses Diberikan
    await prisma.accessLog.create({
      data: {
        credentialId: `FINGER_${fingerId}`,
        status: 'SUCCESS',
      }
    });

    const successMessage = `✅ AKSES DIBERIKAN: Pintu Utama dibuka menggunakan SIDIK JARI oleh ${fingerprint.user.name} [${fingerprint.user.role}] pada ${formattedDate} WIB.`;
    await sendTelegramMessage(successMessage);

    return res.status(200).json({
      authorized: true,
      message: 'Access granted',
      user: fingerprint.user.name
    });

  } catch (error) {
    console.error('Error verifying Fingerprint:', error);
    return res.status(500).json({
      authorized: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
