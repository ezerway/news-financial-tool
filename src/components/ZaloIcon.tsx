import React from 'react';

export default function ZaloIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.48 5.43 3.79 7.04-.16 1.25-.77 3.16-.81 3.25-.06.18.08.36.27.32 1.63-.33 3.68-1.12 4.55-1.51.72.16 1.45.25 2.2.25 5.52 0 10-4.03 10-9s-4.48-9-10-9zm-4.2 13.5l4.6-6H8.2V7.7h6.2v1.7l-4.6 6h4.8v1.8H7.8v-1.7z"
      />
    </svg>
  );
}
