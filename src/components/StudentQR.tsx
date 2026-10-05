"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function StudentQR() {
  const [img, setImg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;

    async function load() {
      try {
        const res = await fetch("/api/attendance/token", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not get your code");
        const url = await QRCode.toDataURL(json.token, { width: 280, margin: 1 });
        if (!stop) {
          setImg(url);
          setError("");
        }
      } catch (err) {
        if (!stop) setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }

    load();
    const timer = setInterval(load, 20_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto inline-block rounded-xl bg-white p-3">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="Your attendance QR code" width={280} height={280} />
        ) : (
          <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-gray-500">
            Loading...
          </div>
        )}
      </div>
      <p className="text-sm opacity-70">
        Show this code to your teacher. It refreshes every 20 seconds.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}