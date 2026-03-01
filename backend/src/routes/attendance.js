const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const router = express.Router();

// GET attendance sessions for a class
router.get('/class/:classId', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id) AS attended_count
       FROM attendance_sessions s
       WHERE s.class_id = ? ORDER BY s.date DESC`,
      [req.params.classId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create attendance session
router.post('/session', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { class_id, date } = req.body;
  if (!class_id || !date) return res.status(400).json({ message: 'class_id and date required' });
  try {
    const qrToken = uuidv4();
    const qrExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const [result] = await db.query(
      `INSERT INTO attendance_sessions (class_id, date, qr_token, qr_expires_at, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [class_id, date, qrToken, qrExpiresAt, req.user.id]
    );
    // Generate QR code as URL for easy phone scanning
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrData = `${baseUrl}/student-attendance-system/#/checkin?sessionId=${result.insertId}&token=${qrToken}`;
    const qrImage = await QRCode.toDataURL(qrData);
    res.status(201).json({
      sessionId: result.insertId, qrToken, qrImage, qrExpiresAt,
      message: 'Session created. QR valid for 15 minutes.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET QR code for existing session
router.get('/session/:sessionId/qr', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM attendance_sessions WHERE id = ?', [req.params.sessionId]);
    if (!rows.length) return res.status(404).json({ message: 'Session not found' });
    const session = rows[0];
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrData = `${baseUrl}/student-attendance-system/#/checkin?sessionId=${session.id}&token=${session.qr_token}`;
    const qrImage = await QRCode.toDataURL(qrData);
    res.json({ qrImage, qrToken: session.qr_token, qrExpiresAt: session.qr_expires_at });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST mark attendance via QR
router.post('/qr-checkin', authenticate, authorize('student'), async (req, res) => {
  const { sessionId, token } = req.body;
  try {
    const [sessions] = await db.query('SELECT * FROM attendance_sessions WHERE id = ? AND qr_token = ?', [sessionId, token]);
    if (!sessions.length) return res.status(400).json({ message: 'Invalid QR code' });

    const session = sessions[0];
    if (new Date() > new Date(session.qr_expires_at)) {
      return res.status(400).json({ message: 'QR code has expired' });
    }

    await db.query(
      `INSERT IGNORE INTO attendance_records (session_id, student_id, status, method)
       VALUES (?, ?, 'present', 'qr')`,
      [sessionId, req.user.id]
    );
    res.json({ message: 'Attendance marked successfully via QR' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST manual attendance (mark multiple students)
router.post('/manual', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { session_id, records } = req.body; // records: [{student_id, status}]
  if (!session_id || !records?.length) return res.status(400).json({ message: 'session_id and records required' });
  try {
    for (const r of records) {
      await db.query(
        `INSERT INTO attendance_records (session_id, student_id, status, method)
         VALUES (?, ?, ?, 'manual')
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [session_id, r.student_id, r.status || 'present']
      );
    }
    res.json({ message: 'Attendance saved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET records for a session
router.get('/session/:sessionId/records', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.name, u.email
       FROM attendance_records r JOIN users u ON r.student_id = u.id
       WHERE r.session_id = ? ORDER BY u.name`,
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET student's attendance in a class
router.get('/student/:studentId/class/:classId', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.date, r.status, r.method, r.marked_at
       FROM attendance_sessions s
       LEFT JOIN attendance_records r ON r.session_id = s.id AND r.student_id = ?
       WHERE s.class_id = ? ORDER BY s.date DESC`,
      [req.params.studentId, req.params.classId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
