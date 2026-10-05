"use client";

import { useEffect, useRef, useState } from "react";

export default function QRScanner({
  onScan,
  active,
}: {
  onScan: (text: string) => void;
  active: boolean;
}) {
  const callback = useRef(onScan);
  const [error, setError] = useState("");

  useEffect(() => {
    callback.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode("qr-reader");
        scanner = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => callback.current(text),
          () => {}
        );
        setError("");
      } catch {
        setError("Could not open the camera. Allow camera access in your browser and try again.");
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        const s = scanner;
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [active]);

  return (
    <div className="space-y-2">
      <div id="qr-reader" className="overflow-hidden rounded-xl" />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}