import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ExamTake() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/exams/${examId}`).then(r => {
      setExam(r.data);
      setTimeLeft(r.data.duration_minutes * 60);
    });
    api.get(`/questions/exam/${examId}`).then(r => setQuestions(r.data));
  }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const res = await api.post('/submissions', { exam_id: parseInt(examId), answers });
      setResult(res.data);
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setSubmitted(true);
        alert('Bạn đã nộp bài rồi!');
        navigate(-1);
      } else {
        alert(err.response?.data?.message || 'Lỗi nộp bài');
      }
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitted, examId, answers]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!exam || questions.length === 0) {
    return <div className="p-8 text-center text-gray-400">Đang tải bài kiểm tra...</div>;
  }

  if (submitted && result) {
    const percentage = parseFloat(result.percentage);
    const passed = percentage >= 50;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">{passed ? '🎉' : '😔'}</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {passed ? 'Làm bài tốt lắm!' : 'Chúc bạn lần sau tốt hơn!'}
          </h2>
          <div className={`text-5xl font-bold my-6 ${passed ? 'text-green-600' : 'text-red-500'}`}>
            {percentage}%
          </div>
          <p className="text-gray-600 mb-2">
            Đúng <strong>{result.score}</strong> / {result.totalPoints} điểm
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mt-6 text-left space-y-2 max-h-64 overflow-y-auto">
            {questions.map((q, i) => {
              const ga = result.gradedAnswers?.[q.id];
              return (
                <div key={q.id} className={`text-xs p-2 rounded-lg ${ga?.isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <p className="font-medium">Câu {i + 1}: {ga?.isCorrect ? '✅ Đúng' : `❌ Sai (Đáp án: ${ga?.correct})`}</p>
                  {!ga?.isCorrect && <p>Bạn đã chọn: {ga?.answer || 'Không chọn'}</p>}
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate(-1)} className="mt-6 w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 shadow-sm z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-800">{exam.title}</h1>
            <p className="text-xs text-gray-400">{questions.length} câu hỏi</p>
          </div>
          <div className={`text-xl font-bold font-mono px-4 py-2 rounded-lg ${timeLeft <= 60 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            ⏱ {formatTime(timeLeft || 0)}
          </div>
        </div>
        {/* Progress */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-blue-500 transition-all"
            style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="font-medium text-gray-800 mb-4">
              <span className="text-blue-500 mr-2">Câu {i + 1}.</span> {q.content}
            </p>
            <div className="space-y-2">
              {['a', 'b', 'c', 'd'].map(opt => {
                const optionKey = opt.toUpperCase();
                const optionValue = q[`option_${opt}`];
                if (!optionValue) return null;
                const selected = answers[q.id] === optionKey;
                return (
                  <button
                    key={opt}
                    onClick={() => setAnswers({ ...answers, [q.id]: optionKey })}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs mr-3 font-medium ${selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {optionKey}
                    </span>
                    {optionValue}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Đã trả lời <strong>{Object.keys(answers).length}</strong> / {questions.length} câu
          </div>
          <button
            onClick={() => { if (confirm('Nộp bài kiểm tra?')) handleSubmit(); }}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-60"
          >
            {submitting ? 'Đang nộp...' : '✅ Nộp bài'}
          </button>
        </div>
      </div>
    </div>
  );
}
