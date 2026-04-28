/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from "react";
import { Copy, Check, Bot, Image as ImageIcon, Activity, QrCode } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: number;
  user: string;
  command: string;
  type: 'qr' | 'rate' | 'exchange' | 'pdf' | 'qr_gen';
}

export default function App() {
  const [status, setStatus] = useState<{ botTokenSet: boolean; status: string; isProd?: boolean } | null>(null);
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{success: boolean, bot?: any, error?: string} | null>(null);

  const fetchStatus = () => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  };

  const testBot = () => {
    setTestResult(null);
    fetch("/api/test-bot")
      .then(res => res.json())
      .then(data => setTestResult(data))
      .catch(err => setTestResult({ success: false, error: err.message }));
  };

  useEffect(() => {
    fetchStatus();
    fetch("/api/qrcodes")
      .then((res) => res.json())
      .then((data) => setQrCodes(data.files || []))
      .catch(() => {});

    const fetchLogs = () => {
      fetch("/api/logs")
        .then((res) => res.json())
        .then((data) => setLogs(data.logs || []))
        .catch(() => {});
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const resetBot = () => {
    setIsResetting(true);
    setWebhookResult(null);
    fetch("/api/reset-bot")
      .then((res) => res.text())
      .then((msg) => setWebhookResult(msg))
      .catch((err) => setWebhookResult("Error: " + err.message))
      .finally(() => setIsResetting(false));
  };

  const setWebhook = () => {
    setIsResetting(true);
    setWebhookResult(null);
    fetch("/api/set-webhook")
      .then((res) => res.json())
      .then((data) => {
         if (data.success) {
           setWebhookResult(data.message);
         } else {
           setWebhookResult("Failed: " + data.error);
         }
      })
      .catch((err) => setWebhookResult("Error: " + err.message))
      .finally(() => setIsResetting(false));
  };

  const copyFolder = () => {
    navigator.clipboard.writeText("public/KHQR/");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans overflow-y-auto overflow-x-hidden">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
        
        {/* Header & Brand */}
        <header className="md:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between">
          <div className="flex items-center gap-4 text-left w-full sm:w-auto">
            <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Telegram Utility Bot</h1>
              <p className="text-slate-400 text-sm">QR Code Retrieval & Currency Exchange</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
             <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium uppercase tracking-wider">Active</span>
             <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-medium uppercase tracking-wider">v1.0.0</span>
          </div>
        </header>

        {/* Host Stats */}
        <div className="md:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-white" />
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Bot Status</span>
            </div>
            <div className={`w-2 h-2 rounded-full animate-pulse ${status?.botTokenSet ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
          </div>
          <div className={`p-5 rounded-2xl border ${status?.botTokenSet ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'} flex-1 flex flex-col justify-between overflow-hidden shadow-inner`}>
             <div>
               <h3 className={`font-mono text-lg font-bold mb-1 ${status?.botTokenSet ? 'text-emerald-400' : 'text-red-400'}`}>
                 {status?.botTokenSet ? 'CONFIGURED' : 'UNCONFIGURED'}
               </h3>
               <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mb-4">
                 <Activity className="w-3 h-3 text-sky-400" />
                 Mode: {status?.isProd ? 'Production' : 'Development'}
               </p>
             </div>

             <div className="space-y-2">
                {status?.botTokenSet && (
                  <button 
                    onClick={testBot}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    Test Connection
                  </button>
                )}
                {testResult && (
                  <div className={`p-2 rounded-lg text-[9px] font-mono mb-2 ${testResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {testResult.success ? `Connected: @${testResult.bot.username}` : `Error: ${testResult.error}`}
                  </div>
                )}
                {status?.isProd && (
                  <button 
                    onClick={setWebhook}
                    disabled={isResetting}
                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-sky-900/20 flex items-center justify-center gap-2"
                  >
                    {isResetting ? 'Processing...' : (
                      <>
                        <QrCode className="w-3 h-3" />
                        Set Webhook
                      </>
                    )}
                  </button>
                )}
                <button 
                  onClick={resetBot}
                  disabled={isResetting}
                  className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2"
                >
                  {status?.isProd ? 'Reset Webhook' : 'Reset Polling'}
                </button>
                {webhookResult && (
                  <div className="p-2 bg-black/40 rounded-lg">
                    <p className="text-[9px] font-mono text-emerald-400 break-all leading-tight">
                      {webhookResult}
                    </p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Main Interaction Preview */}
        <div className="md:col-span-5 md:row-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
            <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
            How to Use
          </h2>
          <div className="flex-1 space-y-6">
            <div className="flex justify-end">
              <div className="bg-sky-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[80%] shadow-md">
                <p className="text-sm font-mono">/viseth</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-100 border border-slate-700 rounded-2xl rounded-tl-none p-4 max-w-[90%] shadow-md">
                <p className="text-xs text-slate-400 mb-1">KHQR Retrieval System</p>
                <div className="bg-white p-2 rounded-lg inline-block mb-2">
                   <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-200 border-4 border-slate-300 flex items-center justify-center text-slate-400">
                     <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12" />
                   </div>
                </div>
                <p className="text-xs sm:text-sm font-medium">Sends the matching QR code image from the matching name.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-sky-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[80%] shadow-md">
                <p className="text-sm font-mono">102</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-100 border border-slate-700 rounded-2xl rounded-tl-none p-4 max-w-[90%] shadow-md">
                <p className="text-xs text-slate-400 mb-1">Exchange Calculator</p>
                <p className="text-xs sm:text-sm font-medium">Calculates exchange rate from CNY to KHR and USD.</p>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
              <div className="bg-sky-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[80%] shadow-md">
                <p className="text-sm font-mono">/qr google.com</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-100 border border-slate-700 rounded-2xl rounded-tl-none p-4 max-w-[90%] shadow-md">
                <p className="text-xs text-slate-400 mb-1 font-bold text-emerald-400">QR Generator ✨</p>
                <div className="bg-white p-2 rounded-lg inline-block mb-2">
                   <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-200 border-4 border-slate-300 flex items-center justify-center text-slate-400">
                     <QrCode className="w-8 h-8 sm:w-12 sm:h-12" />
                   </div>
                </div>
                <p className="text-xs sm:text-sm font-medium">Instantly creates a QR code image for any link or text provided.</p>
              </div>
            </div>
          </div>
        </div>

        {/* QR Directory Status */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-sky-400" />
                Managing QR Codes
              </h2>
              <p className="text-slate-400 text-sm mt-1">Upload exact filename matching command.</p>
            </div>
            <div className="bg-slate-800 p-2 rounded-2xl border border-slate-700 flex items-center gap-2 max-w-full overflow-hidden">
              <span className="text-xs sm:text-sm font-mono text-white pl-2 truncate">public/KHQR/</span>
              <button 
                onClick={copyFolder}
                className="p-1 sm:p-2 border border-slate-600 hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center text-slate-300 shrink-0"
                title="Copy path"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
          
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-4">Storage: /KHQR ({qrCodes.length} Files)</p>
          <div className="space-y-3 flex-1 overflow-auto max-h-[300px] pr-2 custom-scrollbar">
             {qrCodes.length === 0 ? (
               <div className="p-6 bg-slate-800/30 rounded-2xl text-center border border-slate-700 border-dashed h-full flex flex-col items-center justify-center">
                 <p className="text-sm text-slate-400">No QR codes found. Use file explorer to upload images here.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 {qrCodes.map(code => (
                   <div key={code} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                     <span className="text-sm text-slate-300 font-mono truncate mr-2">{code}</span>
                     <span className="text-[10px] text-slate-500 shrink-0 border border-slate-700 px-2 py-0.5 rounded uppercase">Image</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="md:col-span-12 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-2">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-emerald-400" />
                Recent Activity
              </h2>
              <p className="text-xs text-slate-500 mt-1 italic">Note: Logs are ephemeral in Serverless/Vercel and reset on cold starts.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button 
                onClick={resetBot}
                disabled={isResetting}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Activity className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting...' : 'Reset Bot Connection'}
              </button>
              <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-xs font-mono">
                {status?.isProd ? 'Webhook Mode' : 'Polling Mode'}
              </span>
            </div>
          </div>
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 min-h-[250px] max-h-[400px] overflow-y-auto custom-scrollbar">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Activity className="w-8 h-8 opacity-20" />
                <p className="text-sm">No recent activity detected.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800/50 gap-2 sm:gap-4 transition-colors hover:bg-slate-800/50">
                    <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        log.type === 'qr' ? 'bg-sky-500/10 text-sky-400' :
                        log.type === 'qr_gen' ? 'bg-emerald-500/10 text-emerald-400' :
                        log.type === 'exchange' ? 'bg-amber-500/10 text-amber-400' :
                        log.type === 'rate' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-purple-500/10 text-purple-400'
                      }`}>
                         {log.type === 'qr' ? <ImageIcon className="w-4 h-4" /> : 
                          log.type === 'qr_gen' ? <QrCode className="w-4 h-4 text-emerald-400" /> :
                          log.type === 'exchange' ? <Bot className="w-4 h-4 text-amber-400" /> :
                          log.type === 'rate' ? <Bot className="w-4 h-4 text-blue-400" /> :
                          <Activity className="w-4 h-4 text-purple-400" />}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-200 truncate">{log.user}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{log.command}</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono shrink-0 sm:self-center self-end">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bot Link Card */}
        <div className="md:col-span-7 bg-sky-600 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between cursor-pointer hover:bg-sky-500 transition-colors shadow-lg shadow-sky-600/20 group">
          <div className="flex items-center gap-3 mb-2 sm:mb-0">
            <div className="p-2 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.13-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            </div>
            <span className="font-bold text-lg text-white">Deploy this project to Vercel via GitHub</span>
          </div>
          <svg className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
        </div>

      </div>
    </div>
  );
}
