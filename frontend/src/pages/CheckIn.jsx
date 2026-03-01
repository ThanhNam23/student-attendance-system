import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const sessionId = searchParams.get('sessionId');
  const token = searchParams.get('token');

  const [status, setStatus] = useState('idle'); // idle | loading | success | error | already
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!sessionId || !token) {
      setStatus('error');
      setMessage('QR code không hợp lệ.');
      return;
    }

    if (!user) {
      // Save intended URL and redirect to login
      localStorage.setItem('checkin_redirect', window.location.hash);
      navigate('/login');
      return;
    }

    if (user.role !== 'student') {
      setStatus('error');
      setMessage('Chỉ sinh viên mới có thể điểm danh bằng QR.');
      return;
    }

    handleCheckIn();
  }, [user, authLoading]);

  const handleCheckIn = async () => {
    setStatus('loading');
    try {
      const res = await api.post('/attendance/qr-checkin', {
        sessionId: parseInt(sessionId),
        token,
      });
      if (res.data.alreadyMarked) {
        setStatus('already');
        setMessage(res.data.message);
      } else {
        setStatus('success');
        setMessage(res.data.message || 'Điểm danh thành công!');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi điểm danh.';
      if (msg.toLowerCase().includes('expired')) {
        setStatus('error');
        setMessage('QR code đã hết hạn. Vui lòng yêu cầu giáo viên tạo lại.');
      } else if (msg.toLowerCase().includes('invalid')) {
        setStatus('error');
        setMessage('QR code không hợp lệ.');
      } else {
        // Duplicate entry = already checked in
        setStatus('already');
        setMessage('Bạn đã điểm danh buổi học này rồi!');
      }
    }
  };

  const icons = {
    idle: null,
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
  };

  const colors = {
    idle: '',
    loading: 'text-blue-600',
    success: 'text-green-700',
    error: 'text-red-700',
    already: 'text-blue-700',
  };

  const titles = {
    idle: 'Đang xử lý...',
    loading: 'Đang điểm danh...',
    success: 'Điểm danh thành công!',
    error: 'Lỗi điểm danh',
    already: 'Đã điểm danh',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        {/* Logo/Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-800">📚 Hệ thống Điểm danh</h1>
          <p className="text-sm text-gray-400 mt-1">Quét QR điểm danh trực tuyến</p>
        </div>

        {/* Status icon */}
        <div className="mb-6">{icons[status]}</div>

        {/* Title */}
        <h2 className={`text-2xl font-bold mb-3 ${colors[status]}`}>
          {titles[status]}
        </h2>

        {/* Message */}
        {message && (
          <p className="text-gray-600 mb-6">{message}</p>
        )}

        {/* Loading state */}
        {status === 'loading' && (
          <p className="text-gray-400 text-sm">Vui lòng chờ...</p>
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

        {status === 'error' && (
          <div className="space-y-3 mt-4">
            <button
              onClick={handleCheckIn}
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

        {/* User info if logged in */}
        {user && status !== 'loading' && (
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
