import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — light brand tinted */}
      <div
        className="fixed inset-0 bg-[#102A27]/25 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={cn(
          "relative w-full rounded-2xl bg-white border border-[#E3E5E0] p-6 shadow-card-md transition-all z-10 modal-dialog max-h-[90vh] flex flex-col overflow-hidden",
          maxWidthClasses
        )}
      >
        <div className="flex items-start justify-between pb-3 border-b border-[#F0EDE4] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#102A27]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-[#5C6B68]">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#899491] hover:bg-[#F7F6F2] hover:text-[#5C6B68] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 overflow-y-auto flex-1 pr-1 overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
