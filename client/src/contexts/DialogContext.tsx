import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import '../components/SystemDialog.css';

type DialogType = 'alert' | 'confirm' | 'prompt' | 'info';

interface DialogConfig {
  type: DialogType;
  title: string;
  message: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: string;
}

interface DialogState extends DialogConfig {
  id: number;
  inputValue: string;
}

interface DialogContextType {
  showAlert: (title: string, message: string, icon?: string) => Promise<void>;
  showConfirm: (title: string, message: string, icon?: string) => Promise<boolean>;
  showPrompt: (title: string, message: string, defaultValue?: string, icon?: string) => Promise<string | null>;
  showInfo: (title: string, message: string, icon?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogs, setDialogs] = useState<DialogState[]>([]);
  const resolverRef = useRef<Map<number, (value: any) => void>>(new Map());
  const idRef = useRef(0);

  const openDialog = useCallback((config: DialogConfig): Promise<any> => {
    const id = ++idRef.current;
    return new Promise((resolve) => {
      resolverRef.current.set(id, resolve);
      setDialogs(prev => [...prev, { ...config, id, inputValue: config.defaultValue || '' }]);
    });
  }, []);

  const closeDialog = useCallback((id: number, result: any) => {
    const resolver = resolverRef.current.get(id);
    if (resolver) {
      resolver(result);
      resolverRef.current.delete(id);
    }
    setDialogs(prev => prev.filter(d => d.id !== id));
  }, []);

  const handleInputChange = useCallback((id: number, value: string) => {
    setDialogs(prev => prev.map(d => d.id === id ? { ...d, inputValue: value } : d));
  }, []);

  const showAlert = useCallback((title: string, message: string, icon?: string) => {
    return openDialog({ type: 'alert', title, message, icon: icon || '⚠️' });
  }, [openDialog]);

  const showConfirm = useCallback((title: string, message: string, icon?: string) => {
    return openDialog({ type: 'confirm', title, message, icon: icon || '❓' });
  }, [openDialog]);

  const showPrompt = useCallback((title: string, message: string, defaultValue?: string, icon?: string) => {
    return openDialog({ type: 'prompt', title, message, defaultValue, icon: icon || '✏️' });
  }, [openDialog]);

  const showInfo = useCallback((title: string, message: string, icon?: string) => {
    return openDialog({ type: 'info', title, message, icon: icon || 'ℹ️' });
  }, [openDialog]);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt, showInfo }}>
      {children}
      {dialogs.map((dialog) =>
        ReactDOM.createPortal(
          <div key={dialog.id} className="system-dialog-overlay" onClick={() => {
            if (dialog.type === 'alert' || dialog.type === 'info') closeDialog(dialog.id, undefined);
          }}>
            <div className="system-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="system-dialog-header">
                <span className="system-dialog-header-icon">{dialog.icon}</span>
                <span className="system-dialog-title">{dialog.title}</span>
                <button
                  className="system-dialog-close"
                  onClick={() => closeDialog(dialog.id, dialog.type === 'confirm' ? false : dialog.type === 'prompt' ? null : undefined)}
                >
                  ✕
                </button>
              </div>
              <div className="system-dialog-body">
                <div className="system-dialog-icon">{dialog.icon}</div>
                <div className="system-dialog-content">
                  <p className="system-dialog-message">{dialog.message}</p>
                  {dialog.type === 'prompt' && (
                    <input
                      type="text"
                      className="system-dialog-input"
                      value={dialog.inputValue}
                      onChange={(e) => handleInputChange(dialog.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') closeDialog(dialog.id, dialog.inputValue || null);
                        if (e.key === 'Escape') closeDialog(dialog.id, null);
                      }}
                      autoFocus
                    />
                  )}
                </div>
              </div>
              <div className="system-dialog-footer">
                {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
                  <button
                    className="system-dialog-btn system-dialog-btn-secondary"
                    onClick={() => closeDialog(dialog.id, dialog.type === 'confirm' ? false : null)}
                  >
                    {dialog.cancelLabel || 'Abbrechen'}
                  </button>
                )}
                <button
                  className="system-dialog-btn system-dialog-btn-primary"
                  onClick={() => {
                    if (dialog.type === 'confirm') closeDialog(dialog.id, true);
                    else if (dialog.type === 'prompt') closeDialog(dialog.id, dialog.inputValue || null);
                    else closeDialog(dialog.id, undefined);
                  }}
                  autoFocus={dialog.type !== 'prompt'}
                >
                  {dialog.confirmLabel || 'OK'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </DialogContext.Provider>
  );
};
