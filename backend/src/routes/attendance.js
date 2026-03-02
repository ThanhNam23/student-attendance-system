const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const router = express.Router();

// ─── Haversine distance (meters) ─────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ─────────────────────────────────────────────────────────────────────────────

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

    const [result] = await db.query(
      `INSERT IGNORE INTO attendance_records (session_id, student_id, status, method)
       VALUES (?, ?, 'present', 'qr')`,
      [sessionId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.json({ message: 'Bạn đã điểm danh buổi học này rồi!', alreadyMarked: true });
    }
    res.json({ message: 'Điểm danh thành công!', alreadyMarked: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE attendance record
router.delete('/record/:recordId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM attendance_records WHERE id = ?', [req.params.recordId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Attendance record deleted' });
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

// DELETE attendance session (and all its records)
router.delete('/session/:sessionId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM attendance_records WHERE session_id = ?', [req.params.sessionId]);
    const [result] = await db.query('DELETE FROM attendance_sessions WHERE id = ?', [req.params.sessionId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session deleted' });
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

// ─── GPS CHECK-IN ─────────────────────────────────────────────────────────────

// POST create GPS attendance session
router.post('/gps-session', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { class_id, date, lat, lng, radius } = req.body;
  if (!class_id || !date || lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'class_id, date, lat và lng là bắt buộc' });
  }
  try {
    const gpsToken = uuidv4();
    const gpsExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const radiusMeters = parseInt(radius) || 100;

    const [result] = await db.query(
      `INSERT INTO attendance_sessions (class_id, date, gps_token, gps_lat, gps_lng, gps_radius, gps_expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [class_id, date, gpsToken, lat, lng, radiusMeters, gpsExpiresAt, req.user.id]
    );

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const checkinUrl = `${baseUrl}/student-attendance-system/#/gps-checkin?sessionId=${result.insertId}&token=${gpsToken}`;

    res.status(201).json({
      sessionId: result.insertId,
      gpsToken,
      gpsExpiresAt,
      checkinUrl,
      message: `Buổi điểm danh GPS đã tạo. Bán kính: ${radiusMeters}m. Hiệu lực 30 phút.`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET GPS session info (for students to know it exists + expiry)
router.get('/session/:sessionId/gps-info', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, gps_radius, gps_expires_at FROM attendance_sessions WHERE id = ? AND gps_token IS NOT NULL',
      [req.params.sessionId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy buổi điểm danh GPS' });
    const s = rows[0];
    res.json({
      sessionId: s.id,
      radius: s.gps_radius,
      expiresAt: s.gps_expires_at,
      expired: new Date() > new Date(s.gps_expires_at),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST GPS check-in (student submits their location)
router.post('/gps-checkin', authenticate, authorize('student'), async (req, res) => {
  const { sessionId, token, lat, lng } = req.body;
  if (!sessionId || !token || lat === undefined || lng === undefined) {
    return res.status(400).json({ message: 'sessionId, token, lat và lng là bắt buộc' });
  }
  try {
    const [sessions] = await db.query(
      'SELECT * FROM attendance_sessions WHERE id = ? AND gps_token = ?',
      [sessionId, token]
    );
    if (!sessions.length) return res.status(400).json({ message: 'Liên kết điểm danh GPS không hợp lệ' });

    const session = sessions[0];
    if (new Date() > new Date(session.gps_expires_at)) {
      return res.status(400).json({ message: 'Buổi điểm danh GPS đã hết hạn' });
    }

    const distance = haversine(session.gps_lat, session.gps_lng, parseFloat(lat), parseFloat(lng));
    if (distance > session.gps_radius) {
      return res.status(400).json({
        message: `Bạn đang cách lớp học ${Math.round(distance)}m (giới hạn: ${session.gps_radius}m). Vui lòng vào trong phạm vi lớp học.`,
        distance: Math.round(distance),
        radius: session.gps_radius,
        tooFar: true,
      });
    }

    const [result] = await db.query(
      `INSERT IGNORE INTO attendance_records (session_id, student_id, status, method)
       VALUES (?, ?, 'present', 'gps')`,
      [sessionId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.json({ message: 'Bạn đã điểm danh buổi học này rồi!', alreadyMarked: true });
    }
    res.json({
      message: '✅ Điểm danh GPS thành công!',
      alreadyMarked: false,
      distance: Math.round(distance),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
