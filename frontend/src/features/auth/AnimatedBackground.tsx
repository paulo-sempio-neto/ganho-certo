export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#000000]">
      
      {/* Ambient gradient blobs with slow float animation */}
      <div 
        className="absolute top-[-20%] left-[-15%] w-[55%] h-[55%] rounded-full blur-[140px]"
        style={{
          background: "radial-gradient(circle, rgba(6,78,59,0.25) 0%, transparent 70%)",
          animation: "float-blob-1 50s ease-in-out infinite",
        }}
      />
      <div 
        className="absolute bottom-[-15%] right-[-20%] w-[50%] h-[50%] rounded-full blur-[140px]"
        style={{
          background: "radial-gradient(circle, rgba(39,39,42,0.35) 0%, transparent 70%)",
          animation: "float-blob-2 60s ease-in-out infinite",
        }}
      />
      <div 
        className="absolute top-[30%] left-[40%] w-[25%] h-[25%] rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)",
          animation: "float-blob-3 45s ease-in-out infinite",
        }}
      />

      {/* Ultra-fine dot grid */}
      <div 
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse at center, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 75%)",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#000000_100%)] opacity-80" />

      {/* Film grain */}
      <div 
        className="absolute inset-0 mix-blend-overlay opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes float-blob-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(5%, 8%) scale(1.05); }
          50% { transform: translate(-3%, 4%) scale(0.97); }
          75% { transform: translate(7%, -3%) scale(1.03); }
        }
        @keyframes float-blob-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-6%, -5%) scale(1.04); }
          66% { transform: translate(4%, 7%) scale(0.96); }
        }
        @keyframes float-blob-3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
          50% { transform: translate(-8%, 5%) scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
