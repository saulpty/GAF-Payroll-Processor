import React, { useRef, useEffect, useCallback } from 'react';
import SignaturePadLib from 'signature_pad';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  error?: string;
}

// PDF field bounds for signature: 150pt × 22pt at 96dpi scale ~2x
const PAD_WIDTH = 400;
const PAD_HEIGHT = 80;

export default function SignaturePad({ onChange, error }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePadLib(canvas, {
      minWidth: 1,
      maxWidth: 2.5,
      penColor: '#000000',
    });
    padRef.current = pad;
    pad.addEventListener('endStroke', () => {
      onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'));
    });
    return () => {
      pad.off();
    };
  }, [onChange]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    onChange(null);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`border rounded-md bg-white overflow-hidden inline-block ${error ? 'border-red-500' : 'border-border'}`}
        style={{ width: PAD_WIDTH, maxWidth: '100%' }}
      >
        <canvas
          ref={canvasRef}
          width={PAD_WIDTH}
          height={PAD_HEIGHT}
          className="block touch-none"
          style={{ width: PAD_WIDTH, height: PAD_HEIGHT, maxWidth: '100%' }}
        />
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="text-xs text-muted-foreground underline w-fit"
      >
        Clear signature
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
