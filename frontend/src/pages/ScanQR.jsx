import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import QRScanner from '../components/QRScanner';

export default function ScanQR() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('scanning'); // scanning | loading | success | error | already
  const [message, setMessage] = useState('');
  const [scanned, setScanned] = useState(false);

  const handleScanSuccess = async (decodedText) => {
    if (scanned) return; // prevent double scan
    setScanned(true);
    setStatus('loading');

    try {
      // Parse URL: .../student-attendance-system/#/checkin?sessionId=X&token=Y
      // Params are after '#' so we need to parse the hash fragment
      let sessionId, token;
      try {
        const url = new URL(decodedText);
        // Hash-based routing: hash = "#/checkin?sessionId=1&token=xxx"
        const hashPart = url.hash; // e.g. "#/checkin?sessionId=1&token=xxx"
        const queryIndex = hashPart.indexOf('?');
        if (queryIndex !== -1) {
          const queryString = hashPart.slice(queryIndex + 1);
          const params = new URLSearchParams(queryString);
          sessionId = params.get('sessionId');
          token = params.get('token');
        }
        // Fallback: try normal searchParams (non-hash URL)
        if (!sessionId || !token) {
          sessionId = url.searchParams.get('sessionId');
          token = url.searchParams.get('token');
        }
      } catch {
        // fallback: try JSON
        try {
          const data = JSON.parse(decodedText);
          sessionId = data.sessionId;
          token = data.token;
        } catch {
          // not valid JSON either
        }
      }

      if (!sessionId || !token) {
        setStatus('error');
        setMessage('QR code không hợp lệ hoặc không phải mã điểm danh.');
        return;
      }

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
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('expired')) {
        setStatus('error');
        setMessage('QR code đã hết hạn. Vui lòng yêu cầu giáo viên tạo lại.');
      } else if (msg.toLowerCase().includes('invalid')) {
        setStatus('error');
        setMessage('QR code không hợp lệ.');
      } else {
        setStatus('already');
        setMessage('Bạn đã điểm danh buổi học này rồi!');
      }
    }
  };

  const handleScanError = (err) => {
    setStatus('error');
    setMessage('Không thể mở camera. Vui lòng cho phép truy cập camera.');
  };

  const reset = () => {
    setScanned(false);
    setStatus('scanning');
    setMessage('');
  };

  const icons = {
    loading: (
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
    ),
    success: (
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    already: (
      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-10 h-10 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z" />
        </svg>
      </div>
    ),
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Quay lại
        </button>
        <h1 className="text-2xl font-bold text-gray-800">📷 Quét QR điểm danh</h1>
      </div>

      {status === 'scanning' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-blue-50 border-b border-blue-100 text-center">
            <p className="text-sm text-blue-700 font-medium">
              Hướng camera vào mã QR của giáo viên
            </p>
          </div>
          <div className="p-4">
            <QRScanner onScanSuccess={handleScanSuccess} onScanError={handleScanError} />
          </div>
          <div className="p-4 text-center text-xs text-gray-400">
            Camera sẽ tự động nhận diện mã QR
          </div>
        </div>
      )}

      {status !== 'scanning' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          {icons[status]}

          <h2 className={`text-xl font-bold mb-2 ${
            status === 'success' ? 'text-green-700' :
            status === 'error' ? 'text-red-700' :
            status === 'loading' ? 'text-blue-700' :
            'text-yellow-700'
          }`}>
            {status === 'success' && 'Điểm danh thành công!'}
            {status === 'error' && 'Lỗi điểm danh'}
            {status === 'loading' && 'Đang xử lý...'}
            {status === 'already' && 'Đã điểm danh rồi'}
          </h2>

          {message && <p className="text-gray-500 mb-6">{message}</p>}

          {status !== 'loading' && (
            <div className="space-y-3">
              {(status === 'error') && (
                <button
                  onClick={reset}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Quét lại
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors"
              >
                Về trang chính
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
