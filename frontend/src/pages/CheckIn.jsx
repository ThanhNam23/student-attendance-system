import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const sessionId = searchParams.get('sessionId');
  const token = searchParams.get('token');

  // status: idle | locating | loading | success | already | tooFar | error
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [distInfo, setDistInfo] = useState(null); // { distance, radius }
  const hasStarted = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (hasStarted.current) return;

    if (!sessionId || !token) {
      setStatus('error');
      setMessage('QR code không hợp lệ.');
      return;
    }
    if (!user) {
      localStorage.setItem('checkin_redirect', window.location.hash);
      navigate('/login');
      return;
    }
    if (user.role !== 'student') {
      setStatus('error');
      setMessage('Chỉ sinh viên mới có thể điểm danh bằng QR.');
      return;
    }

    hasStarted.current = true;
    startCheckIn();
  }, [user, authLoading]);

  const startCheckIn = () => {
    if (!navigator.geolocation) {
      doCheckIn(null, null, null);
      return;
    }
    setStatus('locating');

    const SAMPLE_MS = 5000;
    const GOOD_ACCURACY = 20;
    let bestPosition = null;
    let watchId = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      if (bestPosition) {
        doCheckIn(bestPosition.coords.latitude, bestPosition.coords.longitude, Math.round(bestPosition.coords.accuracy));
      } else {
        doCheckIn(null, null, null);
      }
    };

    const timer = setTimeout(finish, SAMPLE_MS);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
        }
        if (bestPosition.coords.accuracy <= GOOD_ACCURACY) {
          clearTimeout(timer);
          finish();
        }
      },
      () => {
        clearTimeout(timer);
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(watchId);
        doCheckIn(null, null, null); // let backend reject if GPS required
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const doCheckIn = async (lat, lng, accuracy) => {
    setStatus('loading');
    try {
      const body = { sessionId: parseInt(sessionId), token };
      if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
        if (accuracy != null) body.accuracy = accuracy;
      }
      const res = await api.post('/attendance/qr-checkin', body);
      if (res.data.alreadyMarked) {
        setStatus('already');
        setMessage(res.data.message);
      } else {
        setStatus('success');
        setMessage(res.data.message || 'Điểm danh thành công!');
      }
    } catch (err) {
      const data = err.response?.data || {};
      if (data.tooFar) {
        setStatus('tooFar');
        setDistInfo({ distance: data.distance, radius: data.radius });
        setMessage(data.message || 'Bạn đang ở quá xa.');
      } else if (data.requiresGps) {
        setStatus('error');
        setMessage('Buổi học này yêu cầu GPS. Vui lòng cho phép truy cập vị trí và thử lại.');
      } else {
        const msg = data.message || 'Lỗi điểm danh.';
        if (msg.includes('hết hạn') || msg.toLowerCase().includes('expired')) {
          setStatus('error');
          setMessage('QR code đã hết hạn. Vui lòng yêu cầu giáo viên tạo lại.');
        } else if (msg.includes('hợp lệ') || msg.toLowerCase().includes('invalid')) {
          setStatus('error');
          setMessage('QR code không hợp lệ.');
        } else if (msg.includes('đã điểm danh') || msg.toLowerCase().includes('already')) {
          setStatus('already');
          setMessage('Bạn đã điểm danh buổi học này rồi!');
        } else {
          setStatus('error');
          setMessage(msg);
        }
      }
    }
  };

  const retryWithLocation = () => {
    hasStarted.current = true;
    setStatus('idle');
    setDistInfo(null);
    setMessage('');
    startCheckIn();
  };

  const icons = {
    idle: null,
    locating: (
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    ),
    loading: (
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
    ),
    success: (
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    already: (
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
        </svg>
      </div>
    ),
    tooFar: (
      <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    ),
  };

  const colors = {
    idle: '',
    locating: 'text-blue-600',
    loading: 'text-blue-600',
    success: 'text-green-700',
    error: 'text-red-700',
    already: 'text-blue-700',
    tooFar: 'text-orange-600',
  };

  const titles = {
    idle: 'Đang chuẩn bị...',
    locating: 'Đang lấy vị trí GPS...',
    loading: 'Đang điểm danh...',
    success: 'Điểm danh thành công!',
    error: 'Lỗi điểm danh',
    already: 'Đã điểm danh',
    tooFar: 'Ngoài phạm vi cho phép',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-800">📚 Hệ thống Điểm danh</h1>
          <p className="text-sm text-gray-400 mt-1">QR + Xác minh vị trí GPS</p>
        </div>

        {/* Icon */}
        <div className="mb-6">{icons[status]}</div>

        {/* Title */}
        <h2 className={`text-2xl font-bold mb-3 ${colors[status]}`}>
          {titles[status]}
        </h2>

        {/* Locating hint */}
        {status === 'locating' && (
          <p className="text-gray-500 text-sm mb-4">Vui lòng cho phép trình duyệt truy cập vị trí của bạn...</p>
        )}

        {/* Loading hint */}
        {status === 'loading' && (
          <p className="text-gray-400 text-sm">Vui lòng chờ...</p>
        )}

        {/* Too far: distance bar */}
        {status === 'tooFar' && distInfo && (
          <div className="mb-6">
            <p className="text-gray-600 text-sm mb-4">{message}</p>
            <div className="bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
              <div
                className="h-full bg-orange-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (distInfo.radius / distInfo.distance) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>0m</span>
              <span className="text-orange-600 font-semibold">Bạn: {distInfo.distance}m</span>
              <span className="text-green-600 font-semibold">Giới hạn: {distInfo.radius}m</span>
            </div>
            <p className="text-xs text-gray-400 mt-3">Di chuyển lại gần hơn và thử lại.</p>
          </div>
        )}

        {/* Generic message */}
        {message && status !== 'tooFar' && (
          <p className="text-gray-600 mb-6">{message}</p>
        )}

        {/* Action buttons */}
        {(status === 'success' || status === 'already') && (
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Về trang chính
          </button>
        )}

        {status === 'tooFar' && (
          <div className="space-y-3 mt-2">
            <button
              onClick={retryWithLocation}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 rounded-xl transition-colors"
            >
              📍 Thử lại
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors"
            >
              Về trang chính
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3 mt-4">
            <button
              onClick={retryWithLocation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Thử lại
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors"
            >
              Về trang chính
            </button>
          </div>
        )}

        {/* User info */}
        {user && !['idle', 'locating', 'loading'].includes(status) && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Đăng nhập với: <span className="font-medium text-gray-600">{user.name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
