import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ExamsPage() {
  const { id: classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', duration_minutes: 45 });
  const [showQuestions, setShowQuestions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qForm, setQForm] = useState({ content: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', points: 1 });
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const loadExams = () => {
    api.get(`/exams/class/${classId}`).then(r => setExams(r.data)).finally(() => setLoading(false));
  };

  const loadQuestions = (examId) => {
    api.get(`/questions/exam/${examId}`).then(r => setQuestions(r.data));
  };

  useEffect(() => { loadExams(); }, [classId]);

  const createExam = async (e) => {
    e.preventDefault();
    try {
      await api.post('/exams', { ...form, class_id: classId });
      setForm({ title: '', duration_minutes: 45 });
      setShowForm(false);
      loadExams();
    } catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  const changeStatus = async (examId, status) => {
    await api.put(`/exams/${examId}/status`, { status });
    loadExams();
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.post('/questions', { ...qForm, exam_id: showQuestions });
      setQForm({ content: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', points: 1 });
      loadQuestions(showQuestions);
    } catch (err) { alert(err.response?.data?.message || 'Lỗi'); }
  };

  const deleteQuestion = async (qId) => {
    await api.delete(`/questions/${qId}`);
    loadQuestions(showQuestions);
  };

  const statusColor = { draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700', closed: 'bg-red-100 text-red-600' };
  const statusLabel = { draft: 'Nháp', active: 'Đang mở', closed: 'Đã đóng' };

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">← Quay lại</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📝 Bài kiểm tra</h1>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Tạo bài kiểm tra
          </button>
        )}
      </div>

      {showForm && canManage && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
          <form onSubmit={createExam} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tiêu đề *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Kiểm tra giữa kỳ..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">Thời gian (phút)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Tạo</button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">Hủy</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải...</div>
      ) : exams.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><div className="text-5xl mb-4">📭</div><p>Chưa có bài kiểm tra nào</p></div>
      ) : (
        <div className="space-y-4">
          {exams.map(exam => (
            <div key={exam.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-800">{exam.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[exam.status]}`}>
                      {statusLabel[exam.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">⏱ {exam.duration_minutes} phút • 📋 {exam.question_count} câu • 👥 {exam.submission_count} nộp bài</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {canManage && (
                    <>
                      <button
                        onClick={() => { setShowQuestions(exam.id); loadQuestions(exam.id); }}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
                      >
                        ✏️ Câu hỏi
                      </button>
                      <button
                        onClick={() => navigate(`/exam/${exam.id}/results`)}
                        className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg"
                      >
                        📊 Kết quả
                      </button>
                      {exam.status === 'draft' && (
                        <button onClick={() => changeStatus(exam.id, 'active')} className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg">
                          ▶ Mở bài
                        </button>
                      )}
                      {exam.status === 'active' && (
                        <button onClick={() => changeStatus(exam.id, 'closed')} className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded-lg">
                          ⏹ Đóng
                        </button>
                      )}
                    </>
                  )}
                  {user?.role === 'student' && exam.status === 'active' && (
                    <button
                      onClick={() => navigate(`/exam/${exam.id}/take`)}
                      className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg"
                    >
                      ✏️ Làm bài
                    </button>
                  )}
                  {user?.role === 'student' && exam.status === 'closed' && (
                    <button
                      onClick={() => navigate(`/exam/${exam.id}/results`)}
                      className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg"
                    >
                      📊 Xem kết quả
                    </button>
                  )}
                </div>
              </div>

              {/* Question manager */}
              {canManage && showQuestions === exam.id && (
                <div className="border-t border-gray-100 p-5">
                  <h4 className="font-medium text-gray-700 mb-4">Quản lý câu hỏi</h4>
                  {/* Add question form */}
                  <form onSubmit={addQuestion} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                    <textarea
                      placeholder="Nội dung câu hỏi *"
                      value={qForm.content}
                      onChange={e => setQForm({ ...qForm, content: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {['a', 'b', 'c', 'd'].map(opt => (
                        <input
                          key={opt}
                          type="text"
                          placeholder={`Đáp án ${opt.toUpperCase()}`}
                          value={qForm[`option_${opt}`]}
                          onChange={e => setQForm({ ...qForm, [`option_${opt}`]: e.target.value })}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ))}
                    </div>
                    <div className="flex gap-3 items-center">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Đáp án đúng</label>
                        <select
                          value={qForm.correct_answer}
                          onChange={e => setQForm({ ...qForm, correct_answer: e.target.value })}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {['A', 'B', 'C', 'D'].map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Điểm</label>
                        <input
                          type="number"
                          value={qForm.points}
                          onChange={e => setQForm({ ...qForm, points: e.target.value })}
                          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min={1}
                        />
                      </div>
                      <button type="submit" className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                        + Thêm câu
                      </button>
                    </div>
                  </form>

                  {/* Questions list */}
                  {questions.map((q, i) => (
                    <div key={q.id} className="border border-gray-100 rounded-lg p-3 mb-2 flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">Câu {i + 1}: {q.content}</p>
                        <div className="grid grid-cols-2 gap-1 mt-2">
                          {['a', 'b', 'c', 'd'].map(opt => (
                            <p key={opt} className={`text-xs px-2 py-1 rounded ${q.correct_answer === opt.toUpperCase() ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>
                              {opt.toUpperCase()}. {q[`option_${opt}`]}
                            </p>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => deleteQuestion(q.id)} className="text-xs text-red-400 hover:text-red-600 ml-3">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
