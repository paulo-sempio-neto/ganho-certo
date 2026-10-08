import React from 'react';

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 bg-[#000000] overflow-hidden -z-50 pointer-events-none selection:bg-none">
      <style>
        {`
          @keyframes float-1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(3%, -5%) scale(1.05); }
            66% { transform: translate(-2%, 4%) scale(0.95); }
          }
          @keyframes float-2 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(-4%, 5%) scale(0.95); }
            66% { transform: translate(4%, -3%) scale(1.05); }
          }
          @keyframes float-3 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(5%, 5%) scale(1.1); }
          }
          .animate-float-1 { animation: float-1 60s ease-in-out infinite; }
          .animate-float-2 { animation: float-2 75s ease-in-out infinite; }
          .animate-float-3 { animation: float-3 90s ease-in-out infinite; }
          
          .dot-grid {
            background-image: radial-gradient(rgba(255, 255, 255, 1) 1px, transparent 1px);
            background-size: 24px 24px;
            mask-image: radial-gradient(circle at center, black 30%, transparent 100%);
            -webkit-mask-image: radial-gradient(circle at center, black 30%, transparent 100%);
          }
          
          .film-grain {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          }
        `}
      </style>

      {/* Soft Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] max-w-[1200px] max-h-[1200px] rounded-full bg-emerald-900/20 blur-[120px] animate-float-1" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] max-w-[1000px] max-h-[1000px] rounded-full bg-zinc-800/30 blur-[120px] animate-float-2" />
      <div className="absolute top-[20%] left-[20%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-emerald-500/[0.03] blur-[100px] animate-float-3" />

      {/* Grid, Vignette & Grain */}
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_120%)]" />
      <div className="absolute inset-0 film-grain opacity-[0.015] mix-blend-overlay" />
    </div>
  );
}
