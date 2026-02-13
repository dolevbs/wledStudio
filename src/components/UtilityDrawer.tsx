"use client";

import type { ReactNode } from "react";

interface UtilityDrawerProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function UtilityDrawer({ open, onToggle, children }: UtilityDrawerProps) {
  return (
    <section className="panelShell utilityDrawer">
      <div className="utilityDrawerHeader">
        <h2 className="sectionLabel">Utilities</h2>
        <div className="utilityActions">
          <button type="button" className={open ? "pillButton active" : "pillButton"} onClick={onToggle} aria-expanded={open}>
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {open ? <div className="utilityDrawerBody">{children}</div> : null}
    </section>
  );
}
