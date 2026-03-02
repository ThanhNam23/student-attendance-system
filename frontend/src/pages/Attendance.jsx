import { useEffect, useRef, useState } from 'react';
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
  const [gpsCheckinUrl, setGpsCheckinUrl] = useState('');
  const [gpsExpiry, setGpsExpiry] = useState(null);
  const [gpsRadius, setGpsRadius] = useState(null);
  const [gpsCopied, setGpsCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualStatus, setManualStatus] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'manual'
  const pollRef = useRef(null);
  const selectedSessionRef = useRef(null);
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const loadSessions = () => {
    api.get(`/attendance/class/${classId}`).then(r => setSessions(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
    if (canManage) api.get(`/classes/${classId}/students`).then(r => setStudents(r.data));
    return () => clearInterval(pollRef.current);
  }, [classId]);

  // Auto-refresh records every 10s when QR is active
  useEffect(() => {
    clearInterval(pollRef.current);
    if (qrImage && selectedSessionRef.current) {
      pollRef.current = setInterval(() => {
        refreshRecords(selectedSessionRef.current, false);
        loadSessions();
      }, 10000);
    }
    return () => clearInterval(pollRef.current);
  }, [qrImage]);

  const refreshRecords = async (session, showIndicator = true) => {
    if (!session) return;
    if (showIndicator) setRefreshing(true);
    try {
      const res = await api.get(`/attendance/session/${session.id}/records`);
      setRecords(res.data);
      loadSessions();
    } finally {
      if (showIndicator) setRefreshing(false);
    }
  };

  const viewSession = async (session) => {
    setSelectedSession(session);
    selectedSessionRef.current = session;
    await refreshRecords(session);
  };

  const createSession = () => {
    const today = new Date().toISOString().split('T')[0];
    setCreating(true);

    const doCreate = async (lat, lng, radius) => {
      try {
        const body = { class_id: classId, date: today };
        if (lat !== undefined) { body.lat = lat; body.lng = lng; body.radius = radius; }
        const res = await api.post('/attendance/session', body);
        setQrImage(res.data.qrImage);
        setQrExpiry(new Date(res.data.qrExpiresAt));
        setGpsCheckinUrl(res.data.gpsCheckinUrl || '');
        setGpsExpiry(res.data.gpsExpiresAt ? new Date(res.data.gpsExpiresAt) : null);
        setGpsRadius(res.data.gpsRadius || null);
        setActiveTab('auto');
        loadSessions();
        setTimeout(() => viewSession({ id: res.data.sessionId, date: today }), 500);
      } catch (err) {
        alert(err.response?.data?.message || 'Lỗi tạo buổi điểm danh');
      } finally {
        setCreating(false);
      }
    };

    if (!navigator.geolocation) {
      doCreate();
      return;
    }
    const radiusInput = prompt('Đặt bán kính GPS cho phép (mét):\n(Bấm Hủy nếu chỉ muốn dùng QR)', '100');
    if (radiusInput === null) {
      // User cancelled GPS — create QR only
      doCreate();
      return;
    }
    const radius = parseInt(radiusInput) || 100;
    navigator.geolocation.getCurrentPosition(
      (pos) => doCreate(pos.coords.latitude, pos.coords.longitude, radius),
      () => {
        if (confirm('Không lấy được GPS.\nTạo buổi chỉ QR thôi?')) doCreate();
        else setCreating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveManual = async () => {
    if (!selectedSession) return alert('Vui lòng chọn hoặc tạo buổi học trước.');
    // Build from ALL students — use manualStatus override or fallback to existing record status or 'absent'
    const recordsArr = students.map(s => ({
      student_id: s.id,
      status: manualStatus[s.id] ?? (records.find(r => r.student_id === s.id)?.status ?? 'absent'),
    }));
    if (!recordsArr.length) return alert('Không có sinh viên trong lớp.');
    try {
      await api.post('/attendance/manual', { session_id: selectedSession.id, records: recordsArr });
      alert('Lưu điểm danh thành công!');
      setManualStatus({}); // reset overrides after save
      await refreshRecords(selectedSession);
    } catch (err) {
      alert('Ồi lưu điểm danh: ' + (err.response?.data?.message || err.message));
    }
  };

  const createManualSession = async () => {
    const today = new Date().toISOString().split('T')[0];
    setCreating(true);
    try {
      const res = await api.post('/attendance/manual-session', { class_id: classId, date: today });
      setActiveTab('manual');
      setQrImage('');
      setGpsCheckinUrl('');
      loadSessions();
      setTimeout(() => viewSession({ id: res.data.sessionId, date: today }), 500);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi tạo buổi điểm danh');
    } finally {
      setCreating(false);
    }
  };

  const deleteRecord = async (recordId) => {
    if (!confirm('Xóa bản ghi điểm danh này?')) return;
    try {
      await api.delete(`/attendance/record/${recordId}`);
      await refreshRecords(selectedSession);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xóa điểm danh');
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Xóa buổi học này và toàn bộ dữ liệu điểm danh?')) return;
    try {
      await api.delete(`/attendance/session/${sessionId}`);
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        selectedSessionRef.current = null;
        setRecords([]);
        setQrImage('');
        clearInterval(pollRef.current);
      }
      loadSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi xóa buổi học');
    }
  };

  const statusColor = { present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700', late: 'bg-yellow-100 text-yellow-700' };
  const statusLabel = { present: 'Có mặt', absent: 'Vắng', late: 'Trễ' };
  const autoRecords = records.filter(r => r.method === 'qr' || r.method === 'gps');

  const copyGpsUrl = () => {
    navigator.clipboard.writeText(gpsCheckinUrl).then(() => {
      setGpsCopied(true);
      setTimeout(() => setGpsCopied(false), 2000);
    });
  };

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">← Quay lại</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">✅ Điểm danh</h1>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={createManualSession}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {creating ? '⏳ Đang tạo...' : '✏️ Thủ công'}
            </button>
            <button
              onClick={createSession}
              disabled={creating}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {creating ? '⏳ Đang tạo...' : '+ Tạo buổi điểm danh'}
            </button>
          </div>
        )}
      </div>

      {/* Combined QR + GPS info card */}
      {qrImage && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className={`grid gap-6 ${gpsCheckinUrl ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {/* QR side */}
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-3">📱 Quét QR</h3>
              <img src={qrImage} alt="QR Code" className="mx-auto w-44 h-44" />
              <p className="text-xs text-gray-500 mt-2">Hết hạn: {qrExpiry?.toLocaleTimeString('vi-VN')}</p>
              <p className="text-xs text-green-500 mt-0.5 animate-pulse">● Tự động cập nhật mỗi 10 giây</p>
            </div>
            {/* GPS side */}
            {gpsCheckinUrl && (
              <div className="flex flex-col justify-center">
                <h3 className="font-semibold text-gray-800 mb-3 text-center">📍 GPS Check-in</h3>
                <div className="bg-gray-50 rounded-lg p-3 mb-3 flex items-center gap-2">
                  <p className="text-xs text-gray-600 truncate flex-1 font-mono">{gpsCheckinUrl}</p>
                  <button
                    onClick={copyGpsUrl}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      gpsCopied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {gpsCopied ? '✔ Đã sao chép' : 'Sao chép'}
                  </button>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>🔹 Bán kính: <strong>{gpsRadius}m</strong></span>
                  <span>⏱ Hết hạn: <strong>{gpsExpiry?.toLocaleTimeString('vi-VN')}</strong></span>
                </div>
                <p className="text-xs text-gray-400 text-center">Sinh viên phải đứng trong phạm vi {gpsRadius}m</p>
              </div>
            )}
          </div>
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
                    <p className="font-medium text-sm text-gray-800">{new Date(s.date).toLocaleDateString('vi-VN')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.attended_count} sinh viên có mặt</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && <span className="text-xs text-blue-500">Xem →</span>}
                    {canManage && (
                      <button
                        onClick={(e) => deleteSession(e, s.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors"
                        title="Xóa buổi học"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session detail panel */}
        {canManage && selectedSession && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">
                {new Date(selectedSession.date).toLocaleDateString('vi-VN')}
              </h2>
              <button
                onClick={() => refreshRecords(selectedSession)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? 'Đang tải...' : 'Làm mới'}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('auto')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'auto' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📱 QR + GPS ({autoRecords.length})
              </button>
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ✏️ Thủ công
              </button>
            </div>

            {/* Tab: QR + GPS combined records */}
            {activeTab === 'auto' && (
              <div className="flex-1 overflow-y-auto max-h-80">
                {autoRecords.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Chưa có sinh viên nào điểm danh</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {autoRecords.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.name}</p>
                          <p className="text-xs text-gray-400">{new Date(r.marked_at).toLocaleTimeString('vi-VN')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            r.method === 'gps' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {r.method === 'gps' ? '📍 GPS' : '📱 QR'}
                          </span>
                          <button
                            onClick={() => deleteRecord(r.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors"
                            title="Xóa điểm danh"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Manual */}
            {activeTab === 'manual' && (
              <>
                <div className="flex-1 divide-y divide-gray-50 overflow-y-auto max-h-72">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                      <p className="text-sm text-gray-800">{s.name}</p>
                      <div className="flex gap-1">
                        {['present', 'late', 'absent'].map(st => {
                          // Use manual override first, then existing record, then default 'absent'
                          const current = manualStatus[s.id] ?? (records.find(r => r.student_id === s.id)?.status ?? 'absent');
                          return (
                            <button
                              key={st}
                              onClick={() => setManualStatus(prev => ({ ...prev, [s.id]: st }))}
                              className={`text-xs px-2 py-1 rounded-lg transition-colors ${current === st ? statusColor[st] : 'bg-gray-100 text-gray-500'}`}
                            >
                              {statusLabel[st]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button onClick={saveManual} className="w-full bg-green-600 text-white text-sm py-2 rounded-xl hover:bg-green-700 transition-colors">
                    💾 Lưu điểm danh
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
