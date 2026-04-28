/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from "react";
import { Copy, Check, Bot, Image as ImageIcon } from "lucide-react";

export default function App() {
  const [status, setStatus] = useState<{ botTokenSet: boolean; status: string } | null>(null);
  const [qrCodes, setQrCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error(err));

    fetch("/api/qrcodes")
      .then((res) => res.json())
      .then((data) => setQrCodes(data.files || []))
      .catch((err) => console.error(err));
  }, []);

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
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-5 h-5 text-white" />
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Bot Status</span>
          </div>
          <div className={`p-4 rounded-xl border ${status?.botTokenSet ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'} flex-1 flex flex-col justify-center`}>
             <h3 className={`font-mono text-lg ${status?.botTokenSet ? 'text-emerald-400' : 'text-red-400'}`}>
               {status?.botTokenSet ? 'Token Set' : 'Missing Token'}
             </h3>
             <p className={`text-xs mt-1 ${status?.botTokenSet ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
               {status?.botTokenSet 
                  ? 'Bot is running and listening.' 
                  : 'Add TELEGRAM_BOT_TOKEN to Secrets.'}
             </p>
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
          <div className="space-y-3 flex-1">
             {qrCodes.length === 0 ? (
               <div className="p-6 bg-slate-800/30 rounded-2xl text-center border border-slate-700 border-dashed h-full flex flex-col items-center justify-center">
                 <p className="text-sm text-slate-400">No QR codes found. Use file explorer to upload images here.</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
