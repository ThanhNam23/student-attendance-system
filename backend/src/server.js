require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database/init');

const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const examRoutes = require('./routes/exams');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://thanhnam23.github.io',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow if origin matches allowedOrigins
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Server is running' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;

// Cleanup expired tokens every hour (NULL out token fields — keep session + records)
const db = require('./database/db');
function scheduleTokenCleanup() {
  const HOUR = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const [r] = await db.query(
        `UPDATE attendance_sessions
         SET qr_token = NULL, qr_expires_at = NULL
         WHERE qr_expires_at IS NOT NULL AND qr_expires_at < NOW()`
      );
      const [g] = await db.query(
        `UPDATE attendance_sessions
         SET gps_token = NULL, gps_lat = NULL, gps_lng = NULL, gps_radius = NULL, gps_expires_at = NULL
         WHERE gps_expires_at IS NOT NULL AND gps_expires_at < NOW()`
      );
      if (r.affectedRows + g.affectedRows > 0) {
        console.log(`[cleanup] Cleared ${r.affectedRows} QR + ${g.affectedRows} GPS expired tokens`);
      }
    } catch (err) {
      console.error('[cleanup] Token cleanup error:', err.message);
    }
  }, HOUR);
}

// Auto-init database then start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      scheduleTokenCleanup();
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err.message);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} (DB init failed)`);
      scheduleTokenCleanup();
    });
  });

