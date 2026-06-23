import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isAlertOnly?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  variant = 'warning',
  isAlertOnly = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white bg-linear-to-r hover:from-rose-600 hover:to-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-2';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-white bg-linear-to-r focus:ring-2 focus:ring-amber-500 focus:ring-offset-2';
      case 'info':
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white bg-linear-to-r focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isAlertOnly ? onConfirm : onCancel}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Content container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-100 dark:border-slate-900 max-w-md w-full overflow-hidden z-10"
        >
          {/* Header layout */}
          <div className="p-5 flex items-start gap-4">
            <div className={`p-2.5 rounded-lg shrink-0 ${
              variant === 'danger' ? 'bg-rose-50 dark:bg-rose-950/30' :
              variant === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30' :
              'bg-blue-50 dark:bg-blue-950/30'
            }`}>
              {getIcon()}
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {message}
              </p>
            </div>
            {!isAlertOnly && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg p-1.5 transition-colors hover:bg-slate-55 dark:hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/45 flex justify-end gap-2 text-right">
            {!isAlertOnly && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98] cursor-pointer ${getButtonClass()}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
