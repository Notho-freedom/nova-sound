export const BackgroundEffects = () => {
  const isAppleDesign = typeof document !== 'undefined' && document.documentElement.classList.contains('design-apple');
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Grid pattern - excluded for Apple design */}
      {!isAppleDesign && (
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
      )}
      
      {/* Gradient orbs - more subtle for Apple design */}
      {!isAppleDesign ? (
        <>
          <div 
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(var(--neon-cyan)) 0%, transparent 70%)"
            }}
          />
          <div 
            className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(var(--neon-magenta)) 0%, transparent 70%)"
            }}
          />
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(var(--neon-purple)) 0%, transparent 70%)"
            }}
          />
          
          {/* Scanline effect - excluded for Apple design */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)"
            }}
          />
        </>
      ) : (
        /* Apple design: subtle gradient orbs only */
        <>
          <div 
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-5 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)"
            }}
          />
          <div 
            className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-5 blur-3xl"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)"
            }}
          />
        </>
      )}
    </div>
  );
};
