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
  const [qrGpsEnabled, setQrGpsEnabled] = useState(false);
  const [qrGpsRadius, setQrGpsRadius] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manualStatus, setManualStatus] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'manual'
  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('qr'); // 'qr' | 'manual'
  const [formName, setFormName] = useState('');
  const [formMinutes, setFormMinutes] = useState(15);
  const [formRadius, setFormRadius] = useState(0); // 0 = no GPS
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

  const openForm = (type) => {
    setFormType(type);
    setFormName('');
    setFormMinutes(15);
    setFormRadius(0);
    setShowForm(true);
  };

  const submitForm = async () => {
    const today = new Date().toISOString().split('T')[0];
    setCreating(true);
    setShowForm(false);
    const name = formName.trim() || null;

    if (formType === 'manual') {
      try {
        const res = await api.post('/attendance/manual-session', { class_id: classId, date: today, name });
        setActiveTab('manual');
        setQrImage('');
        loadSessions();
        setTimeout(() => viewSession({ id: res.data.sessionId, date: today, name }), 500);
      } catch (err) {
        alert(err.response?.data?.message || 'Lỗi tạo buổi điểm danh');
      } finally {
        setCreating(false);
      }
      return;
    }

    // QR type — optionally get GPS
    const doCreate = async (lat, lng) => {
      try {
        const body = { class_id: classId, date: today, name, qrMinutes: formMinutes };
        if (lat !== undefined) { body.lat = lat; body.lng = lng; body.radius = formRadius; }
        const res = await api.post('/attendance/session', body);
        setQrImage(res.data.qrImage);
        setQrExpiry(new Date(res.data.qrExpiresAt));
        setQrGpsEnabled(res.data.gpsEnabled || false);
        setQrGpsRadius(res.data.gpsRadius || null);
        setActiveTab('auto');
        loadSessions();
        setTimeout(() => viewSession({ id: res.data.sessionId, date: today, name }), 500);
      } catch (err) {
        alert(err.response?.data?.message || 'Lỗi tạo buổi điểm danh');
      } finally {
        setCreating(false);
      }
    };

    if (formRadius > 0 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => doCreate(pos.coords.latitude, pos.coords.longitude),
        () => { if (confirm('Không lấy được GPS.\nTạo buổi chỉ QR thôi?')) doCreate(); else setCreating(false); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      doCreate();
    }
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
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultFormName = new Date().toLocaleDateString('vi-VN');

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">← Quay lại</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">✅ Điểm danh</h1>
        {canManage && (
          <button
            onClick={() => openForm('qr')}
            disabled={creating}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {creating ? '⏳ Đang tạo...' : '+ Tạo buổi điểm danh'}
          </button>
        )}
      </div>

      {/* Create session form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-5">Tạo buổi điểm danh</h2>

            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
              <button
                onClick={() => setFormType('qr')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  formType === 'qr' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                📱 QR
              </button>
              <button
                onClick={() => setFormType('manual')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  formType === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                ✏️ Thủ công
              </button>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên buổi học <span className="text-gray-400 font-normal">(tùy chọn)</span></label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder={defaultFormName}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>

            {/* QR-only options */}
            {formType === 'qr' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian hiệu lực QR <span className="text-gray-400 font-normal">(phút)</span></label>
                  <input
                    type="number"
                    min={1} max={480}
                    value={formMinutes}
                    onChange={e => setFormMinutes(Math.max(1, parseInt(e.target.value) || 15))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bán kính GPS <span className="text-gray-400 font-normal">(mét, 0 = tắt)</span></label>
                  <input
                    type="number"
                    min={0} max={5000}
                    value={formRadius}
                    onChange={e => setFormRadius(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  {formRadius > 0 && <p className="text-xs text-blue-500 mt-1">📍 Sinh viên phải đứng trong {formRadius}m khi quét QR</p>}
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={submitForm}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors ${
                  formType === 'qr' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR info card */}
      {qrImage && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="text-center">
            <h3 className="font-semibold text-gray-800 mb-3">📱 Mã QR điểm danh</h3>
            <img src={qrImage} alt="QR Code" className="mx-auto w-48 h-48" />
            <p className="text-xs text-gray-500 mt-2">Hết hạn: {qrExpiry?.toLocaleTimeString('vi-VN')}</p>
            {qrGpsEnabled && <p className="text-xs text-blue-500 mt-0.5">📍 Yêu cầu vị trí GPS trong {qrGpsRadius}m</p>}
            <p className="text-xs text-green-500 mt-0.5 animate-pulse">● Tự động cập nhật mỗi 10 giây</p>
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
                    <p className="font-medium text-sm text-gray-800">{s.name || new Date(s.date).toLocaleDateString('vi-VN')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.name ? new Date(s.date).toLocaleDateString('vi-VN') + ' • ' : ''}{s.attended_count} sinh viên có mặt</p>
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
                {selectedSession.name || new Date(selectedSession.date).toLocaleDateString('vi-VN')}
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
