import React from "react";

export const PageGradient = () => {
  return (
    <div>
      <div className="fixed inset-0 bg-[url('/gaming-pattern.png')] opacity-5 pointer-events-none"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-primary/20 via-transparent to-gold/20 pointer-events-none"></div>
    </div>
  );
};
