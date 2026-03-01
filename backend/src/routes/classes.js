const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET all classes (teacher sees own, student sees enrolled, admin sees all)
router.get('/', authenticate, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await db.query(
        `SELECT c.*, u.name AS teacher_name,
          (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) AS student_count
         FROM classes c JOIN users u ON c.teacher_id = u.id ORDER BY c.created_at DESC`
      );
    } else if (req.user.role === 'teacher') {
      [rows] = await db.query(
        `SELECT c.*, u.name AS teacher_name,
          (SELECT COUNT(*) FROM enrollments WHERE class_id = c.id) AS student_count
         FROM classes c JOIN users u ON c.teacher_id = u.id
         WHERE c.teacher_id = ? ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    } else {
      [rows] = await db.query(
        `SELECT c.*, u.name AS teacher_name
         FROM classes c JOIN users u ON c.teacher_id = u.id
         JOIN enrollments e ON e.class_id = c.id
         WHERE e.student_id = ? ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create class (teacher/admin)
router.post('/', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { name, subject, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Class name required' });
  try {
    const [result] = await db.query(
      'INSERT INTO classes (name, subject, teacher_id, description) VALUES (?, ?, ?, ?)',
      [name, subject || '', req.user.id, description || '']
    );
    res.status(201).json({ message: 'Class created', classId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single class
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, u.name AS teacher_name FROM classes c JOIN users u ON c.teacher_id = u.id WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Class not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE class
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Class deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST enroll student in class
router.post('/:id/enroll', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { student_id } = req.body;
  try {
    await db.query('INSERT IGNORE INTO enrollments (class_id, student_id) VALUES (?, ?)', [req.params.id, student_id]);
    res.json({ message: 'Student enrolled' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET students in a class
router.get('/:id/students', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, e.enrolled_at
       FROM users u JOIN enrollments e ON e.student_id = u.id
       WHERE e.class_id = ? ORDER BY u.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE unenroll student
router.delete('/:id/students/:studentId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM enrollments WHERE class_id = ? AND student_id = ?', [req.params.id, req.params.studentId]);
    res.json({ message: 'Student removed from class' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
