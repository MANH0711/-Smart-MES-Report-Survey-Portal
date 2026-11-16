import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCodeSvg({
  value,
  size = 160,
  className = '',
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: 1,
      color: { dark: '#0B2B5B', light: '#FFFFFF' },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {
        if (active) setSvgMarkup('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!svgMarkup) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded border border-slate-200 bg-white text-[11px] text-slate-400 ${className}`}
      >
        QR
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 ${className}`}
      style={{ width: size + 16, height: size + 16 }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
