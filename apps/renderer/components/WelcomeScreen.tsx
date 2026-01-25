import React from 'react';
interface WelcomeScreenProps {
  input?: React.ReactNode;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ input }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[60vh] gap-6 fx-soft-fade">
      <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-5xl font-semibold text-[var(--ink-1)] tracking-tight sm:text-6xl">
            Catflash
          </h1>
        </div>
      </div>
      {input ? <div className="w-full max-w-[min(52rem,100%)]">{input}</div> : null}
    </div>
  );
};

export default WelcomeScreen;
