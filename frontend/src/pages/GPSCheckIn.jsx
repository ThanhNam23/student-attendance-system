import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function GPSCheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const sessionId = searchParams.get('sessionId');
  const token = searchParams.get('token');

  const [status, setStatus] = useState('idle'); // idle | locating | submitting | success | error | already | tooFar
  const [message, setMessage] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [distance, setDistance] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // Countdown timer
  useEffect(() => {
    if (!sessionInfo?.expiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(sessionInfo.expiresAt) - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionInfo]);

  useEffect(() => {
    if (authLoading) return;
    if (!sessionId || !token) {
      setStatus('error');
      setMessage('Đường dẫn điểm danh GPS không hợp lệ.');
      return;
    }
    if (!user) {
      localStorage.setItem('checkin_redirect', window.location.hash);
      navigate('/login');
      return;
    }
    if (user.role !== 'student') {
      setStatus('error');
      setMessage('Chỉ sinh viên mới có thể điểm danh GPS.');
      return;
    }
    fetchSessionInfo();
  }, [user, authLoading]);

  const fetchSessionInfo = async () => {
    setStatus('locating');
    try {
      const res = await api.get(`/attendance/session/${sessionId}/gps-info`);
      if (res.data.expired) {
        setStatus('error');
        setMessage('Buổi điểm danh GPS đã hết hạn. Vui lòng yêu cầu giáo viên tạo lại.');
        return;
      }
      setSessionInfo(res.data);
      // Automatically start locating
      requestLocation(res.data);
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.message || 'Không tải được thông tin buổi học.');
    }
  };

  const requestLocation = (info) => {
    setStatus('locating');
    setMessage('');
    setGpsAccuracy(null);
    if (!navigator.geolocation) {
      setStatus('error');
      setMessage('Trình duyệt của bạn không hỗ trợ GPS. Vui lòng dùng trình duyệt khác.');
      return;
    }

    // Thu thập nhiều mẫu GPS trong SAMPLE_MS ms, chọn mẫu có accuracy tốt nhất.
    // Nếu đã có mẫu accuracy <= GOOD_ACCURACY thì dùng ngay.
    const SAMPLE_MS = 5000;    // thời gian thu mẫu tối đa (ms)
    const GOOD_ACCURACY = 20;  // ngưỡng "đủ tốt" (m) — dừng sớm khi đạt

    let bestPosition = null;
    let watchId = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      if (bestPosition) {
        setGpsAccuracy(Math.round(bestPosition.coords.accuracy));
        handleLocation(bestPosition, info);
      } else {
        setStatus('error');
        setMessage('Không thể xác định vị trí. Hãy thử lại ở nơi có tín hiệu tốt hơn.');
      }
    };

    const timer = setTimeout(finish, SAMPLE_MS);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
          setGpsAccuracy(Math.round(pos.coords.accuracy));
        }
        // Dừng sớm nếu đã đủ chính xác
        if (bestPosition.coords.accuracy <= GOOD_ACCURACY) {
          clearTimeout(timer);
          finish();
        }
      },
      (err) => {
        clearTimeout(timer);
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(watchId);
        setStatus('error');
        if (err.code === 1) {
          setMessage('Bạn đã từ chối quyền truy cập vị trí. Vui lòng cho phép và thử lại.');
        } else if (err.code === 2) {
          setMessage('Không thể xác định vị trí. Hãy thử lại ở nơi có tín hiệu tốt hơn.');
        } else {
          setMessage('Lỗi lấy vị trí GPS. Vui lòng thử lại.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleLocation = async (pos, info) => {
    const { latitude, longitude, accuracy } = pos.coords;
    setStatus('submitting');
    try {
      const res = await api.post('/attendance/gps-checkin', {
        sessionId: parseInt(sessionId),
        token,
        lat: latitude,
        lng: longitude,
        accuracy: Math.round(accuracy),
      });
      if (res.data.alreadyMarked) {
        setStatus('already');
        setMessage(res.data.message);
      } else {
        setStatus('success');
        setMessage(res.data.message || '✅ Điểm danh GPS thành công!');
        setDistance(res.data.distance);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.tooFar) {
        setStatus('tooFar');
        setDistance(data.distance);
        setMessage(data.message);
        setSessionInfo(prev => ({ ...prev, radius: data.radius }));
      } else if (data?.message?.includes('hết hạn')) {
        setStatus('error');
        setMessage('Buổi điểm danh GPS đã hết hạn.');
      } else {
        setStatus('error');
        setMessage(data?.message || 'Lỗi điểm danh GPS.');
      }
    }
  };

  const formatTime = (secs) => {
    if (secs === null) return '';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Locating / Submitting screen ─────────────────────────────────────────
  if (authLoading || status === 'idle' || status === 'locating' || status === 'submitting') {
    const label = status === 'submitting' ? 'Đang xác nhận điểm danh...' : 'Đang lấy vị trí GPS của bạn...';
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">📍</div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Điểm danh GPS</h2>
          <p className="text-sm text-gray-500">{label}</p>
          {sessionInfo && (
            <p className="text-xs text-blue-500 mt-3">Bán kính cho phép: {sessionInfo.radius}m</p>
          )}
          {gpsAccuracy !== null && status === 'locating' && (
            <p className="text-xs text-gray-400 mt-1">Độ chính xác hiện tại: ±{gpsAccuracy}m</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Too far screen ────────────────────────────────────────────────────────
  if (status === 'tooFar') {
    const radius = sessionInfo?.radius || 100;
    const pct = Math.min(100, Math.round((radius / distance) * 100));
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold text-orange-700 mb-2">Quá xa lớp học!</h2>
          <p className="text-sm text-gray-600 mb-5">{message}</p>

          {/* Distance visual */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Bạn đang ở</span>
              <span>Khoảng cách: <strong className="text-red-600">{distance}m</strong></span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-green-400 to-red-500 transition-all"
                style={{ width: `${100 - pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-green-600">Lớp học ({radius}m)</span>
              <span className="text-red-500">Vị trí bạn ({distance}m)</span>
            </div>
          </div>

          {timeLeft !== null && timeLeft > 0 && (
            <p className="text-xs text-gray-400 mb-4">⏱ Còn lại: <span className="font-mono font-semibold">{formatTime(timeLeft)}</span></p>
          )}

          <button
            onClick={() => requestLocation(sessionInfo)}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            📍 Thử lại vị trí
          </button>
          <p className="text-xs text-gray-400 mt-3">Hãy di chuyển vào trong lớp học rồi bấm thử lại</p>
        </div>
      </div>
    );
  }

  // ─── Result screens ────────────────────────────────────────────────────────
  const resultConfig = {
    success: {
      bg: 'from-green-50 to-emerald-100',
      icon: '✅',
      iconBg: 'bg-green-100',
      titleColor: 'text-green-700',
      title: 'Điểm danh thành công!',
      sub: distance !== null ? `Bạn cách lớp học ${distance}m — đã điểm danh GPS` : null,
    },
    already: {
      bg: 'from-blue-50 to-sky-100',
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      titleColor: 'text-blue-700',
      title: 'Đã điểm danh',
      sub: null,
    },
    error: {
      bg: 'from-red-50 to-rose-100',
      icon: '❌',
      iconBg: 'bg-red-100',
      titleColor: 'text-red-700',
      title: 'Có lỗi xảy ra',
      sub: null,
    },
  };

  const cfg = resultConfig[status] || resultConfig.error;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${cfg.bg} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full">
        <div className={`w-20 h-20 ${cfg.iconBg} rounded-full flex items-center justify-center mx-auto mb-4 text-4xl`}>
          {cfg.icon}
        </div>
        <h2 className={`text-xl font-bold ${cfg.titleColor} mb-2`}>{cfg.title}</h2>
        <p className="text-gray-600 text-sm">{message}</p>
        {cfg.sub && <p className="text-xs text-gray-400 mt-2">{cfg.sub}</p>}
        {status === 'error' && (
          <button
            onClick={fetchSessionInfo}
            className="mt-5 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            🔄 Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
