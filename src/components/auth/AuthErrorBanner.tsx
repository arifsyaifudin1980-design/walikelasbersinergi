import React, { useState } from 'react';
import { AlertCircle, Check, Copy, ExternalLink, LogIn, X } from 'lucide-react';
import { AuthErrorInfo } from '../../firebase';

interface AuthErrorBannerProps {
  error: AuthErrorInfo;
  onDismiss: () => void;
  onTryRedirectLogin?: () => Promise<void>;
  className?: string;
}

export const AuthErrorBanner: React.FC<AuthErrorBannerProps> = ({
  error,
  onDismiss,
  onTryRedirectLogin,
  className = '',
}) => {
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleCopyHostname = async () => {
    if (!error.hostname) return;
    try {
      await navigator.clipboard.writeText(error.hostname);
      setCopiedDomain(true);
      window.setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleRedirectClick = async () => {
    if (!onTryRedirectLogin) return;
    setIsRedirecting(true);
    try {
      await onTryRedirectLogin();
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div
      role="alert"
      className={`p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 text-xs text-left ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-rose-950">{error.title}</span>
              {error.code && (
                <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                  {error.code}
                </code>
              )}
            </div>
            <p className="text-rose-800 leading-relaxed">{error.message}</p>

            {(error.hostname || error.consoleAuthSettingsUrl || (error.canTryRedirect && onTryRedirectLogin)) && (
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {error.hostname && (
                  <button
                    type="button"
                    onClick={handleCopyHostname}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100/60 text-[11px] font-semibold text-[#0B192C] cursor-pointer"
                  >
                    {copiedDomain ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Domain Tersalin ({error.hostname})</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>Salin Domain: {error.hostname}</span>
                      </>
                    )}
                  </button>
                )}

                {error.consoleAuthSettingsUrl && (
                  <a
                    href={error.consoleAuthSettingsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B192C] hover:bg-[#142844] text-[11px] font-semibold text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Buka Firebase Auth Settings</span>
                  </a>
                )}

                {error.canTryRedirect && onTryRedirectLogin && (
                  <button
                    type="button"
                    disabled={isRedirecting}
                    onClick={handleRedirectClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B192C] hover:bg-[#142844] text-[11px] font-semibold text-white cursor-pointer disabled:opacity-60"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {isRedirecting ? 'Mengalihkan ke Google...' : 'Login Mode Pengalihan (Redirect)'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pesan kendala autentikasi"
          className="text-rose-500 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-100/80 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
