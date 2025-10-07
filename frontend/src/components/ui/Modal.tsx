// components/Modal.tsx
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md">
        {children}
        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
