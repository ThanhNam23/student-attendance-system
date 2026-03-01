const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

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
