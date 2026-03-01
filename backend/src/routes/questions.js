const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET questions for an exam
// Students only see questions without correct_answer when exam is active
router.get('/exam/:examId', authenticate, async (req, res) => {
  try {
    const [examRows] = await db.query('SELECT * FROM exams WHERE id = ?', [req.params.examId]);
    if (!examRows.length) return res.status(404).json({ message: 'Exam not found' });

    let query = 'SELECT * FROM questions WHERE exam_id = ? ORDER BY id';
    // Hide answers from students
    if (req.user.role === 'student') {
      query = 'SELECT id, exam_id, content, type, option_a, option_b, option_c, option_d, points FROM questions WHERE exam_id = ? ORDER BY id';
    }
    const [rows] = await db.query(query, [req.params.examId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add question to exam
router.post('/', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { exam_id, content, type, option_a, option_b, option_c, option_d, correct_answer, points } = req.body;
  if (!exam_id || !content || !correct_answer) return res.status(400).json({ message: 'exam_id, content, correct_answer required' });
  try {
    const [result] = await db.query(
      `INSERT INTO questions (exam_id, content, type, option_a, option_b, option_c, option_d, correct_answer, points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam_id, content, type || 'multiple_choice', option_a, option_b, option_c, option_d, correct_answer, points || 1]
    );
    res.status(201).json({ message: 'Question added', questionId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST bulk add questions
router.post('/bulk', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { questions } = req.body; // array of question objects
  if (!questions?.length) return res.status(400).json({ message: 'questions array required' });
  try {
    for (const q of questions) {
      await db.query(
        `INSERT INTO questions (exam_id, content, type, option_a, option_b, option_c, option_d, correct_answer, points)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [q.exam_id, q.content, q.type || 'multiple_choice', q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.points || 1]
      );
    }
    res.status(201).json({ message: `${questions.length} questions added` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update question
router.put('/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  const { content, option_a, option_b, option_c, option_d, correct_answer, points } = req.body;
  try {
    await db.query(
      `UPDATE questions SET content=?, option_a=?, option_b=?, option_c=?, option_d=?, correct_answer=?, points=? WHERE id=?`,
      [content, option_a, option_b, option_c, option_d, correct_answer, points, req.params.id]
    );
    res.json({ message: 'Question updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE question
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM questions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
