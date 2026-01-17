import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  backdrop?: "image" | "blur";
  closeable?: boolean;
}

export default function Modal({ open, onClose, children, backdrop = "image", closeable = true }: ModalProps) {
  if (!open) return null;

  const backdropClass = backdrop === "image"
    ? "bg-[url('/loading_1.png')] bg-cover bg-center"
    : "bg-black/50";

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-50 ${backdropClass}`}>
      <div className="relative text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg w-full max-w-md">
        {/* Close button */}
        {closeable ?
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          : <></>}
        {/* Modal content */}
        {children}
      </div>
    </div>
  );
}