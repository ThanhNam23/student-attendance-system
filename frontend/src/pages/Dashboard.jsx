import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [pendingExams, setPendingExams] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => setClasses(r.data)).catch(() => {}),
      api.get('/exams/pending').then(r => setPendingExams(r.data.count)).catch(() => setPendingExams(0)),
    ]).finally(() => setLoading(false));
  }, []);

  const roleLabel = { admin: 'Quản trị viên', teacher: 'Giảng viên', student: 'Sinh viên' };
  const roleColor = { admin: 'text-purple-600', teacher: 'text-blue-600', student: 'text-green-600' };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          Xin chào, {user?.name}! 👋
        </h1>
        <p className={`text-sm mt-1 font-medium ${roleColor[user?.role]}`}>
          {roleLabel[user?.role]}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Lớp học</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{loading ? '...' : classes.length}</p>
            </div>
            <div className="text-4xl">📚</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {user?.role === 'student' ? 'Bài thi cần làm' : 'Bài thi đang mở'}
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{loading ? '...' : (pendingExams ?? 0)}</p>
            </div>
            <div className="text-4xl">📝</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Vai trò hệ thống</p>
              <p className={`text-xl font-bold mt-1 ${roleColor[user?.role]}`}>
                {roleLabel[user?.role]}
              </p>
            </div>
            <div className="text-4xl">
              {user?.role === 'admin' ? '👑' : user?.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent classes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Lớp học gần đây</h2>
          <button
            onClick={() => navigate('/classes')}
            className="text-sm text-blue-600 hover:underline"
          >
            Xem tất cả →
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Đang tải...</div>
        ) : classes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Chưa có lớp học nào.{' '}
            {(user?.role === 'teacher' || user?.role === 'admin') && (
              <button onClick={() => navigate('/classes')} className="text-blue-600 hover:underline">
                Tạo lớp ngay →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {classes.slice(0, 5).map(cls => (
              <div
                key={cls.id}
                onClick={() => navigate(`/classes/${cls.id}`)}
                className="p-4 px-6 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-800">{cls.name}</p>
                  <p className="text-sm text-gray-500">{cls.subject} • GV: {cls.teacher_name}</p>
                </div>
                {cls.student_count !== undefined && (
                  <span className="text-sm text-gray-400">{cls.student_count} sinh viên</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
