"use client";

interface TopBarProps {
  powerOn: boolean;
  running: boolean;
  utilityOpen: boolean;
  onTogglePower: () => void;
  onToggleRunning: () => void;
  onToggleUtility: () => void;
}

export function TopBar({ powerOn, running, utilityOpen, onTogglePower, onToggleRunning, onToggleUtility }: TopBarProps) {
  return (
    <header className="topBar panelShell">
      <div className="brandMark">
        <span className="brandDot" aria-hidden>
          ■
        </span>
        <span>WLED Studio</span>
      </div>
      <nav className="topBarActions" aria-label="Primary controls">
        <button type="button" className={powerOn ? "pillButton active" : "pillButton"} onClick={onTogglePower}>
          Power
        </button>
        <button type="button" className={running ? "pillButton active" : "pillButton"} onClick={onToggleRunning}>
          {running ? "Pause" : "Run"}
        </button>
        <button type="button" className={utilityOpen ? "pillButton active" : "pillButton"} onClick={onToggleUtility}>
          Utilities
        </button>
      </nav>
    </header>
  );
}
