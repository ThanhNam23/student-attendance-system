const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function initDatabase() {
  // First connect without selecting a DB to create it
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  console.log('Connected to MySQL server');

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'attendance_db'}`);
  await connection.query(`USE ${process.env.DB_NAME || 'attendance_db'}`);

  // Users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','teacher','student') NOT NULL DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Classes table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      subject VARCHAR(100),
      teacher_id INT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Class enrollments
  await connection.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      student_id INT NOT NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_enrollment (class_id, student_id)
    )
  `);

  // Attendance sessions
  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      name VARCHAR(200) NULL,
      date DATE NOT NULL,
      qr_token VARCHAR(100) UNIQUE,
      qr_expires_at DATETIME,
      gps_token VARCHAR(100) NULL,
      gps_lat DOUBLE NULL,
      gps_lng DOUBLE NULL,
      gps_radius INT DEFAULT 100,
      gps_expires_at DATETIME NULL,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    )
  `);

  // Migrate: add columns if they don't exist (for existing databases)
  try {
    await connection.query(`ALTER TABLE users ADD COLUMN role ENUM('admin','teacher','student') NOT NULL DEFAULT 'student'`);
    console.log('✅ Migrated: added role column to users');
  } catch (_) {}
  // Set first user as admin if role column just created
  try {
    await connection.query(`UPDATE users SET role = 'teacher' WHERE role = 'student' AND id IN (SELECT id FROM (SELECT id FROM users WHERE id NOT IN (SELECT id FROM users WHERE role = 'admin') ORDER BY id LIMIT 1) t)`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN name VARCHAR(200) NULL`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN gps_token VARCHAR(100) NULL`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN gps_lat DOUBLE NULL`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN gps_lng DOUBLE NULL`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN gps_radius INT DEFAULT 100`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN gps_expires_at DATETIME NULL`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE attendance_sessions ADD COLUMN created_by INT NULL`);
  } catch (_) {}
  try {
    await connection.query(`ALTER TABLE exams ADD COLUMN created_by INT NULL`);
  } catch (_) {}

  // Migrate: add 'gps' value to attendance_records.method ENUM if missing
  try {
    await connection.query(`ALTER TABLE attendance_records MODIFY method ENUM('manual','qr','gps') DEFAULT 'manual'`);
  } catch (_) {}

  // Attendance records
  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT NOT NULL,
      student_id INT NOT NULL,
      status ENUM('present','absent','late') DEFAULT 'present',
      method ENUM('manual','qr','gps') DEFAULT 'manual',
      marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_record (session_id, student_id)
    )
  `);

  // Exams table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS exams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      class_id INT NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 45,
      start_time DATETIME,
      end_time DATETIME,
      status ENUM('draft','active','closed') DEFAULT 'draft',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    )
  `);

  // Questions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      exam_id INT NOT NULL,
      content TEXT NOT NULL,
      type ENUM('multiple_choice','true_false') DEFAULT 'multiple_choice',
      option_a VARCHAR(500),
      option_b VARCHAR(500),
      option_c VARCHAR(500),
      option_d VARCHAR(500),
      correct_answer ENUM('A','B','C','D') NOT NULL,
      points INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    )
  `);

  // Submissions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      exam_id INT NOT NULL,
      student_id INT NOT NULL,
      answers JSON,
      score DECIMAL(5,2),
      total_points INT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_submission (exam_id, student_id)
    )
  `);

  // Seed admin user
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await connection.query(`
    INSERT IGNORE INTO users (name, email, password, role)
    VALUES ('Admin', 'admin@school.edu', '${hashedPassword}', 'admin')
  `);

  console.log('✅ Database initialized successfully!');
  console.log('📧 Default admin: admin@school.edu / admin123');
  await connection.end();
}

module.exports = { initDatabase };

// Run directly if called via: node src/database/init.js
if (require.main === module) {
  initDatabase().catch(err => {
    console.error('❌ Database init failed:', err.message);
    process.exit(1);
  });
}
