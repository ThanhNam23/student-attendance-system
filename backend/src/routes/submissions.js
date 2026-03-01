const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// POST submit exam (auto-grade)
router.post('/', authenticate, authorize('student'), async (req, res) => {
  const { exam_id, answers } = req.body; // answers: { questionId: 'A'|'B'|'C'|'D' }
  if (!exam_id || !answers) return res.status(400).json({ message: 'exam_id and answers required' });

  try {
    // Check if already submitted
    const [existing] = await db.query(
      'SELECT id FROM submissions WHERE exam_id = ? AND student_id = ?',
      [exam_id, req.user.id]
    );
    if (existing.length) return res.status(409).json({ message: 'Already submitted this exam' });

    // Check exam is active
    const [examRows] = await db.query('SELECT * FROM exams WHERE id = ?', [exam_id]);
    if (!examRows.length) return res.status(404).json({ message: 'Exam not found' });
    if (examRows[0].status !== 'active') return res.status(400).json({ message: 'Exam is not active' });

    // Get all questions
    const [questions] = await db.query('SELECT * FROM questions WHERE exam_id = ?', [exam_id]);

    // Auto-grade
    let score = 0;
    let totalPoints = 0;
    const gradedAnswers = {};

    for (const q of questions) {
      totalPoints += q.points;
      const studentAnswer = answers[q.id];
      const isCorrect = studentAnswer === q.correct_answer;
      if (isCorrect) score += q.points;
      gradedAnswers[q.id] = { answer: studentAnswer, correct: q.correct_answer, isCorrect };
    }

    const [result] = await db.query(
      `INSERT INTO submissions (exam_id, student_id, answers, score, total_points)
       VALUES (?, ?, ?, ?, ?)`,
      [exam_id, req.user.id, JSON.stringify(gradedAnswers), score, totalPoints]
    );

    res.status(201).json({
      message: 'Exam submitted',
      submissionId: result.insertId,
      score, totalPoints,
      percentage: totalPoints > 0 ? ((score / totalPoints) * 100).toFixed(1) : 0,
      gradedAnswers,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET student's own submission for an exam
router.get('/exam/:examId/my', authenticate, authorize('student'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM submissions WHERE exam_id = ? AND student_id = ?',
      [req.params.examId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'No submission found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all submissions for an exam (teacher/admin)
router.get('/exam/:examId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS student_name, u.email
       FROM submissions s JOIN users u ON s.student_id = u.id
       WHERE s.exam_id = ? ORDER BY s.score DESC`,
      [req.params.examId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
