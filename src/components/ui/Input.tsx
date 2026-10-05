import type { InputHTMLAttributes } from "react";

export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded border border-gray-300 bg-transparent p-2 ${className}`}
      {...props}
    />
  );
}