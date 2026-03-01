const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET all students (admin/teacher only)
router.get('/', authenticate, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, created_at FROM users WHERE role = 'student' ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all teachers
router.get('/teachers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, created_at FROM users WHERE role = 'teacher' ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all users (admin only)
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
