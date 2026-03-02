import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Classes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [examCounts, setExamCounts] = useState({});

  const load = () => {
    api.get('/classes').then(r => setClasses(r.data)).finally(() => setLoading(false));
    api.get('/exams/pending-by-class').then(r => setExamCounts(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/classes', form);
      setForm({ name: '', subject: '', description: '' });
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi tạo lớp');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa lớp này?')) return;
    await api.delete(`/classes/${id}`);
    load();
  };

  const canCreate = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📚 Lớp học</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý các lớp học</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Tạo lớp mới
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Tạo lớp học mới</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Tên lớp *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Môn học"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Mô tả"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 md:col-span-3">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {submitting ? 'Đang tạo...' : 'Tạo lớp'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Class list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải...</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p>Chưa có lớp học nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(cls => (
            <div key={cls.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div
                className="p-5 cursor-pointer"
                onClick={() => navigate(`/classes/${cls.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-xl">
                    📖
                  </div>
                  {cls.student_count !== undefined && (
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                      {cls.student_count} SV
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{cls.name}</h3>
                <p className="text-sm text-gray-500">{cls.subject}</p>
                <p className="text-xs text-gray-400 mt-2">GV: {cls.teacher_name}</p>
              </div>
              <div className="border-t border-gray-50 px-5 py-3 flex gap-2">
                <button
                  onClick={() => navigate(`/classes/${cls.id}/attendance`)}
                  className="flex-1 text-xs text-center py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg"
                >
                  ✅ Điểm danh
                </button>
                <button
                  onClick={() => navigate(`/classes/${cls.id}/exams`)}
                  className="flex-1 text-xs text-center py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg relative"
                >
                  📝 Bài kiểm tra
                  {examCounts[cls.id] > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {examCounts[cls.id]}
                    </span>
                  )}
                </button>
                {canCreate && (
                  <button
                    onClick={() => handleDelete(cls.id)}
                    className="text-xs px-2.5 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
