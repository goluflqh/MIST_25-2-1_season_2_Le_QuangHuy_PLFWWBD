const serviceIconPaths: Record<string, string[]> = {
  DONG_PIN: ["M7 7h10v10H7z", "M17 10h2v4h-2", "M10 10v4", "M13 10v4"],
  PIN: ["M7 7h10v10H7z", "M17 10h2v4h-2", "M10 10v4", "M13 10v4"],
  battery: ["M7 7h10v10H7z", "M17 10h2v4h-2", "M10 10v4", "M13 10v4"],
  DEN_NLMT: ["M12 3v2", "M12 19v2", "M3 12h2", "M19 12h2", "m5.64 5.64 1.42 1.42", "m16.94 16.94 1.42 1.42", "m18.36 5.64-1.42 1.42", "m7.06 16.94-1.42 1.42", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"],
  NLMT: ["M12 3v2", "M12 19v2", "M3 12h2", "M19 12h2", "m5.64 5.64 1.42 1.42", "m16.94 16.94 1.42 1.42", "m18.36 5.64-1.42 1.42", "m7.06 16.94-1.42 1.42", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"],
  PIN_LUU_TRU: ["M8 4h8", "M9 2h6v2H9z", "M7 4h10v17H7z", "m13 8-3 5h3l-2 4"],
  LUU_TRU: ["M8 4h8", "M9 2h6v2H9z", "M7 4h10v17H7z", "m13 8-3 5h3l-2 4"],
  CAMERA: ["M4 7h12a3 3 0 0 1 3 3v7H4z", "m19 11 3-2v8l-3-2", "M8 7l1-3h5l1 3"],
  camera: ["M4 7h12a3 3 0 0 1 3 3v7H4z", "m19 11 3-2v8l-3-2", "M8 7l1-3h5l1 3"],
  CUSTOM: ["m14.7 6.3 3-3a2.1 2.1 0 0 1-3 3l-1.4 1.4", "m9.3 10.7-6 6a2.1 2.1 0 0 0 3 3l6-6", "m8 8 8 8"],
  KHAC: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92Z"],
  contact: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.92Z"],
};

export default function AdminServiceIcon({
  service,
  className = "h-4 w-4",
}: {
  service: string;
  className?: string;
}) {
  const paths = serviceIconPaths[service] || serviceIconPaths.CUSTOM;

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
