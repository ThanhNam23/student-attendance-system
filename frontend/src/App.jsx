import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import AttendancePage from './pages/Attendance';
import ExamsPage from './pages/Exams';
import ExamTake from './pages/ExamTake';
import ExamResults from './pages/ExamResults';
import CheckIn from './pages/CheckIn';
import ScanQR from './pages/ScanQR';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/classes" element={<Classes />} />
              <Route path="/classes/:id" element={<ClassDetail />} />
              <Route path="/classes/:id/attendance" element={<AttendancePage />} />
              <Route path="/classes/:id/exams" element={<ExamsPage />} />
              <Route path="/exam/:examId/take" element={<ExamTake />} />
              <Route path="/exam/:examId/results" element={<ExamResults />} />
              <Route path="/scan" element={<ScanQR />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
