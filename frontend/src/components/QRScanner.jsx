import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScanSuccess, onScanError }) {
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  useEffect(() => {
    const scannerId = 'qr-reader';
    html5QrRef.current = new Html5Qrcode(scannerId);

    html5QrRef.current
      .start(
        { facingMode: 'environment' }, // dùng camera sau
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        (errorMsg) => {
          // Ignore scan errors (camera searching for QR)
        }
      )
      .catch((err) => {
        if (onScanError) onScanError(err);
      });

    return () => {
      if (html5QrRef.current?.isScanning) {
        html5QrRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="w-full">
      <div id="qr-reader" ref={scannerRef} className="w-full rounded-xl overflow-hidden" />
    </div>
  );
}
