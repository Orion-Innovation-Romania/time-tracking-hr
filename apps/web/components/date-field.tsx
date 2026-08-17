"use client";

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import { Calendar } from 'lucide-react';

export default function DateField({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string; // YYYY-MM-DD or empty
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const nativeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(value ? formatDate(value) : '');
  }, [value]);

  const onNative = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value || '';
    onChange(iso);
  };

  const parseTextToIso = (t: string) => {
    const trimmed = t.trim();
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      return `${m[3]}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return '';
  };

  const openPicker = () => {
    const n = nativeRef.current as any;
    if (!n) return;
    if (typeof n.showPicker === 'function') {
      n.showPicker();
      return;
    }
    n.focus();
    n.click();
  };

  return (
    <div className={className} style={{ position: 'relative' }}>
      <Input
        type="text"
        value={text}
        placeholder={placeholder ?? 'dd/mm/yyyy'}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const iso = parseTextToIso(text);
          if (iso) onChange(iso);
          else setText(value ? formatDate(value) : '');
        }}
        style={{ paddingRight: 44 }}
        />

      <button
        type="button"
        onClick={openPicker}
        aria-label="Open date picker"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <Calendar className="h-4 w-4" />
      </button>

      <input
        ref={nativeRef}
        value={value}
        onChange={onNative}
        type="date"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: 48,
          opacity: 0,
          border: 'none',
          padding: 0,
          margin: 0,
          zIndex: 10,
        }}
      />
    </div>
  );
}
