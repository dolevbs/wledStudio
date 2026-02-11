"use client";

import { useEffect, useMemo, useRef } from "react";

import { ControlPanel } from "@/components/ControlPanel";
import { ImportExportPanel } from "@/components/ImportExportPanel";
import { JsonPanel } from "@/components/JsonPanel";
import { StudioRenderer } from "@/rendering/StudioRenderer";
import { useStudioStore } from "@/state/studioStore";

export function StudioShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<Uint8Array>(new Uint8Array());

  const state = useStudioStore();

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    rendererRef.current = new StudioRenderer(canvasRef.current, state.topology);

    const worker = new Worker(new URL("../engine/sim.worker.ts", import.meta.url));
    worker.onmessage = (event: MessageEvent<{ type: string; frame?: Uint8Array; simulatedMillis?: number; error?: string }>) => {
      const data = event.data;
      if (data.type === "frame" && data.frame) {
        frameRef.current = data.frame;
        state.setFrame(data.frame, data.simulatedMillis ?? 0, data.error ?? "");
      }
    };

    worker.postMessage({
      type: "init",
      ledCount: state.topology.ledCount,
      simTickRate: state.simulation.simTickRate
    });

    workerRef.current = worker;

    const resize = () => rendererRef.current?.resize();
    window.addEventListener("resize", resize);

    let animationFrame = 0;
    const renderLoop = () => {
      rendererRef.current?.updateFrame(frameRef.current);
      rendererRef.current?.render();
      animationFrame = window.requestAnimationFrame(renderLoop);
    };
    animationFrame = window.requestAnimationFrame(renderLoop);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      worker.terminate();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.updateTopology(state.topology);
    workerRef.current?.postMessage({ type: "topology", ledCount: state.topology.ledCount });
  }, [state.topology]);

  const commandPayload = useMemo(() => JSON.stringify(state.command), [state.command]);
  useEffect(() => {
    workerRef.current?.postMessage({ type: "json", payload: commandPayload });
  }, [commandPayload]);

  useEffect(() => {
    workerRef.current?.postMessage({ type: "running", running: state.simulation.running });
  }, [state.simulation.running]);

  const onReset = () => {
    state.resetClock();
    workerRef.current?.postMessage({ type: "reset" });
  };

  return (
    <main className="studioRoot">
      <section className="visualShell">
        <div className="statusBar">
          <span>LEDs: {state.topology.ledCount}</span>
          <span>Sim time: {state.simulatedMillis}ms</span>
          <span>Target sim: {state.simulation.simTickRate} TPS</span>
          <span className={state.lastError ? "error" : "ok"}>{state.lastError ? state.lastError : "No engine errors"}</span>
        </div>
        <canvas ref={canvasRef} className="studioCanvas" />
      </section>

      <aside className="sidebar">
        <ControlPanel
          state={{
            topology: state.topology,
            simulation: state.simulation,
            command: state.command,
            setMode: state.setMode,
            setDimensions: state.setDimensions,
            setLedCount: state.setLedCount,
            setSerpentine: state.setSerpentine,
            setGaps: state.setGaps,
            setControl: state.setControl,
            setRunning: state.setRunning
          }}
          onReset={onReset}
        />
        <ImportExportPanel
          state={{
            topology: state.topology,
            command: state.command,
            replaceTopology: state.replaceTopology,
            replaceCommand: state.replaceCommand
          }}
        />
        <JsonPanel
          state={{
            rawJson: state.rawJson,
            setRawJson: state.setRawJson,
            applyRawJson: state.applyRawJson,
            warnings: state.warnings
          }}
        />
      </aside>
    </main>
  );
}
