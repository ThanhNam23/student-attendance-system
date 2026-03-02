const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET pending exams count grouped by class_id for current user
router.get('/pending-by-class', authenticate, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'student') {
      [rows] = await db.query(
        `SELECT e.class_id, COUNT(*) AS cnt FROM exams e
         JOIN enrollments en ON en.class_id = e.class_id AND en.student_id = ?
         WHERE e.status = 'active'
           AND e.id NOT IN (SELECT exam_id FROM submissions WHERE student_id = ?)
         GROUP BY e.class_id`,
        [req.user.id, req.user.id]
      );
    } else {
      [rows] = await db.query(
        `SELECT class_id, COUNT(*) AS cnt FROM exams
         WHERE status = 'active' AND created_by = ?
         GROUP BY class_id`,
        [req.user.id]
      );
    }
    // Return as { classId: count }
    const result = {};
    rows.forEach(r => { result[r.class_id] = Number(r.cnt); });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET pending exams count for current user
// Student: active exams in enrolled classes not yet submitted
// Teacher/admin: active exams they created
router.get('/pending', authenticate, async (req, res) => {
  try {
    let count;
    if (req.user.role === 'student') {
      const [[row]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM exams e
         JOIN enrollments en ON en.class_id = e.class_id AND en.student_id = ?
         WHERE e.status = 'active'
           AND e.id NOT IN (SELECT exam_id FROM submissions WHERE student_id = ?)`,
        [req.user.id, req.user.id]
      );
      count = row.cnt;
    } else {
      const [[row]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM exams WHERE status = 'active' AND created_by = ?`,
        [req.user.id]
      );
      count = row.cnt;
    }
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET exams for a class
router.get('/class/:classId', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*,
        (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) AS question_count,
        (SELECT COUNT(*) FROM submissions WHERE exam_id = e.id) AS submission_count
       FROM exams e WHERE e.class_id = ? ORDER BY e.created_at DESC`,
      [req.params.classId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create exam
router.post('/', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { title, class_id, duration_minutes, start_time, end_time } = req.body;
  if (!title || !class_id) return res.status(400).json({ message: 'title and class_id required' });
  try {
    const [result] = await db.query(
      `INSERT INTO exams (title, class_id, duration_minutes, start_time, end_time, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, class_id, duration_minutes || 45, start_time || null, end_time || null, req.user.id]
    );
    res.status(201).json({ message: 'Exam created', examId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single exam
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Exam not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update exam status
router.put('/:id/status', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'active', 'closed'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  try {
    await db.query('UPDATE exams SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Exam status updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE exam
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM exams WHERE id = ?', [req.params.id]);
    res.json({ message: 'Exam deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
