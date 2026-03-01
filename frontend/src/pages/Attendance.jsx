import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function AttendancePage() {
  const { id: classId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [qrImage, setQrImage] = useState('');
  const [qrExpiry, setQrExpiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualStatus, setManualStatus] = useState({});
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const loadSessions = () => {
    api.get(`/attendance/class/${classId}`).then(r => setSessions(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
    if (canManage) api.get(`/classes/${classId}/students`).then(r => setStudents(r.data));
  }, [classId]);

  const createSession = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await api.post('/attendance/session', { class_id: classId, date: today });
      setQrImage(res.data.qrImage);
      setQrExpiry(new Date(res.data.qrExpiresAt));
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi tạo buổi điểm danh');
    }
  };

  const viewSession = async (session) => {
    setSelectedSession(session);
    const res = await api.get(`/attendance/session/${session.id}/records`);
    setRecords(res.data);
    // init manual status
    const statusMap = {};
    students.forEach(s => {
      const found = res.data.find(r => r.student_id === s.id);
      statusMap[s.id] = found?.status || 'absent';
    });
    setManualStatus(statusMap);
  };

  const saveManual = async () => {
    const recordsArr = Object.entries(manualStatus).map(([student_id, status]) => ({ student_id: parseInt(student_id), status }));
    try {
      await api.post('/attendance/manual', { session_id: selectedSession.id, records: recordsArr });
      alert('Lưu điểm danh thành công!');
      viewSession(selectedSession);
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi lưu điểm danh');
    }
  };

  const statusColor = { present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700', late: 'bg-yellow-100 text-yellow-700' };
  const statusLabel = { present: 'Có mặt', absent: 'Vắng', late: 'Trễ' };

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">← Quay lại</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">✅ Điểm danh</h1>
        {canManage && (
          <button onClick={createSession} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Tạo buổi điểm danh hôm nay
          </button>
        )}
      </div>

      {/* QR Code display */}
      {qrImage && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6 text-center">
          <h3 className="font-semibold text-gray-800 mb-3">📱 QR Code điểm danh</h3>
          <img src={qrImage} alt="QR Code" className="mx-auto w-48 h-48" />
          <p className="text-sm text-gray-500 mt-2">
            Hết hạn: {qrExpiry?.toLocaleTimeString('vi-VN')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Sinh viên scan QR để điểm danh</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Danh sách buổi học</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Đang tải...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Chưa có buổi điểm danh nào</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => canManage && viewSession(s)}
                  className={`p-4 px-5 flex items-center justify-between ${canManage ? 'cursor-pointer hover:bg-gray-50' : ''} ${selectedSession?.id === s.id ? 'bg-blue-50' : ''}`}
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">
                      {new Date(s.date).toLocaleDateString('vi-VN')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.attended_count} sinh viên có mặt</p>
                  </div>
                  {canManage && <span className="text-xs text-blue-500">Xem chi tiết →</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual attendance */}
        {canManage && selectedSession && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                Điểm danh: {new Date(selectedSession.date).toLocaleDateString('vi-VN')}
              </h2>
              <button onClick={saveManual} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700">
                Lưu
              </button>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {students.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-gray-800">{s.name}</p>
                  <div className="flex gap-1">
                    {['present', 'late', 'absent'].map(status => (
                      <button
                        key={status}
                        onClick={() => setManualStatus({ ...manualStatus, [s.id]: status })}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${manualStatus[s.id] === status ? statusColor[status] : 'bg-gray-100 text-gray-500'}`}
                      >
                        {statusLabel[status]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
