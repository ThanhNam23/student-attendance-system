import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function ExamResults() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [mySubmission, setMySubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/exams/${examId}`).then(r => setExam(r.data));
    if (user?.role === 'student') {
      api.get(`/submissions/exam/${examId}/my`)
        .then(r => setMySubmission(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api.get(`/submissions/exam/${examId}`)
        .then(r => setSubmissions(r.data))
        .finally(() => setLoading(false));
    }
  }, [examId, user?.role]);

  if (!exam) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;

  const avgScore = submissions.length
    ? (submissions.reduce((s, r) => s + parseFloat(r.score || 0), 0) / submissions.length).toFixed(1)
    : 0;
  const avgPct = submissions.length
    ? (submissions.reduce((s, r) => s + (r.score / r.total_points) * 100, 0) / submissions.length).toFixed(1)
    : 0;

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">← Quay lại</button>
      <h1 className="text-2xl font-bold text-gray-800 mb-1">📊 Kết quả: {exam.title}</h1>
      <p className="text-sm text-gray-500 mb-6">⏱ {exam.duration_minutes} phút</p>

      {/* Teacher/Admin view */}
      {user?.role !== 'student' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-gray-500 text-sm">Số bài nộp</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{submissions.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-gray-500 text-sm">Điểm trung bình</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{avgScore}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-gray-500 text-sm">Tỉ lệ đúng TB</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{avgPct}%</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Đang tải...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Chưa có sinh viên nào nộp bài</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Danh sách kết quả</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-5 py-3">#</th>
                      <th className="text-left px-5 py-3">Sinh viên</th>
                      <th className="text-left px-5 py-3">Email</th>
                      <th className="text-center px-5 py-3">Điểm</th>
                      <th className="text-center px-5 py-3">Tỉ lệ</th>
                      <th className="text-left px-5 py-3">Nộp lúc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {submissions.map((s, i) => {
                      const pct = ((s.score / s.total_points) * 100).toFixed(1);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-gray-800">{s.student_name}</td>
                          <td className="px-5 py-3 text-gray-500">{s.email}</td>
                          <td className="px-5 py-3 text-center font-bold text-gray-800">{s.score}/{s.total_points}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pct >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {pct}%
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-400">
                            {new Date(s.submitted_at).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Student view */}
      {user?.role === 'student' && (
        loading ? (
          <div className="text-center py-12 text-gray-400">Đang tải...</div>
        ) : !mySubmission ? (
          <div className="text-center py-12 text-gray-400">Bạn chưa nộp bài kiểm tra này.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-md">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{parseFloat(mySubmission.score / mySubmission.total_points * 100) >= 50 ? '✅' : '❌'}</div>
              <p className="text-gray-600 text-sm">Kết quả của bạn</p>
              <p className="text-4xl font-bold text-blue-600 my-2">
                {((mySubmission.score / mySubmission.total_points) * 100).toFixed(1)}%
              </p>
              <p className="text-gray-500">{mySubmission.score} / {mySubmission.total_points} điểm</p>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Nộp lúc: {new Date(mySubmission.submitted_at).toLocaleString('vi-VN')}
            </p>
          </div>
        )
      )}
    </div>
  );
}
