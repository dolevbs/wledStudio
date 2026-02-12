"use client";

import type { RefObject } from "react";

interface LedViewCardProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  ledCount: number;
  simulatedMillis: number;
  simTickRate: number;
  lastError: string;
}

export function LedViewCard({ canvasRef, ledCount, simulatedMillis, simTickRate, lastError }: LedViewCardProps) {
  return (
    <section className="panelShell cardSection">
      <div className="sectionHeaderRow">
        <h2 className="sectionLabel">LEDs View</h2>
        <div className="viewMeta">
          <span>{ledCount} LEDs</span>
          <span>{simulatedMillis}ms</span>
          <span>{simTickRate} TPS</span>
          <span className={lastError ? "errorText" : "okText"}>{lastError ? "Engine Error" : "Healthy"}</span>
        </div>
      </div>
      <div className="ledViewViewport">
        <canvas ref={canvasRef} className="studioCanvas" />
      </div>
    </section>
  );
}
