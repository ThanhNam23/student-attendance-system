import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    api.get(`/classes/${id}`).then(r => setCls(r.data));
    api.get(`/classes/${id}/students`).then(r => setStudents(r.data));
    if (canManage) api.get('/students').then(r => setAllStudents(r.data));
  }, [id]);

  const handleEnroll = async () => {
    if (!selectedStudent) return;
    try {
      await api.post(`/classes/${id}/enroll`, { student_id: selectedStudent });
      api.get(`/classes/${id}/students`).then(r => setStudents(r.data));
      setSelectedStudent('');
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi');
    }
  };

  const handleRemove = async (studentId) => {
    if (!confirm('Xóa sinh viên này khỏi lớp?')) return;
    await api.delete(`/classes/${id}/students/${studentId}`);
    setStudents(students.filter(s => s.id !== studentId));
  };

  if (!cls) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Quay lại
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{cls.name}</h1>
        <p className="text-gray-500">{cls.subject}</p>
        <p className="text-sm text-gray-400 mt-1">Giảng viên: {cls.teacher_name}</p>
        {cls.description && <p className="text-sm text-gray-600 mt-2">{cls.description}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => navigate(`/classes/${id}/attendance`)}
            className="bg-green-50 text-green-700 hover:bg-green-100 px-4 py-2 rounded-lg text-sm font-medium"
          >
            ✅ Quản lý điểm danh
          </button>
          <button
            onClick={() => navigate(`/classes/${id}/exams`)}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium"
          >
            📝 Bài kiểm tra
          </button>
        </div>
      </div>

      {/* Students */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">👥 Danh sách sinh viên ({students.length})</h2>
        </div>

        {canManage && (
          <div className="p-4 border-b border-gray-50 flex gap-3">
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn sinh viên để thêm --</option>
              {allStudents
                .filter(s => !students.find(st => st.id === s.id))
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
            </select>
            <button
              onClick={handleEnroll}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              Thêm
            </button>
          </div>
        )}

        {students.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Chưa có sinh viên nào</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600 font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemove(s.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Xóa
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
