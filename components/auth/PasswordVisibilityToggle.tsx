interface PasswordVisibilityToggleProps {
  disabled?: boolean;
  isVisible: boolean;
  onToggle: () => void;
  testId: string;
}

export function PasswordVisibilityToggle({
  disabled = false,
  isVisible,
  onToggle,
  testId,
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      aria-pressed={isVisible}
      onClick={onToggle}
      disabled={disabled}
      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:text-slate-300"
    >
      {isVisible ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 3l18 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.18A9.8 9.8 0 0112 5c5.25 0 8.25 4.5 9 7a10.74 10.74 0 01-2.1 3.5M6.1 6.53C4.43 7.7 3.38 9.45 3 12c.75 2.5 3.75 7 9 7a9.7 9.7 0 004.1-.91"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      )}
    </button>
  );
}
