import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
};

export default function Button({ variant = "primary", className = "", ...props }: Props) {
  const styles =
    variant === "primary"
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "border border-gray-300";
  return (
    <button
      className={`rounded px-4 py-2 disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}