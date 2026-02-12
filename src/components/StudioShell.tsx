"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ControlDeck } from "@/components/ControlDeck";
import { exportCfgAndPresets, ImportExportPanel } from "@/components/ImportExportPanel";
import { JsonPanel } from "@/components/JsonPanel";
import { LedConfigCard } from "@/components/LedConfigCard";
import { LedViewCard } from "@/components/LedViewCard";
import { StudioRenderer } from "@/rendering/StudioRenderer";
import { TopBar } from "@/components/TopBar";
import { UtilityDrawer } from "@/components/UtilityDrawer";
import { useStudioStore } from "@/state/studioStore";

const DEBUG_SIM = true;

export function StudioShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<Uint8Array>(new Uint8Array());
  const frameCountRef = useRef(0);
  const [diagLines, setDiagLines] = useState<string[]>([]);

  const state = useStudioStore();

  const pushDiag = (line: string, data?: Record<string, unknown>) => {
    const now = new Date().toISOString().slice(11, 23);
    const formatted = data ? `${now} ${line} ${JSON.stringify(data)}` : `${now} ${line}`;
    console.log("[diag]", formatted);
    setDiagLines((prev) => [...prev.slice(-9), formatted]);
  };

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    rendererRef.current = new StudioRenderer(canvasRef.current, state.topology);
    if (DEBUG_SIM) {
      pushDiag("[StudioShell] renderer initialized", {
        ledCount: state.topology.ledCount,
        topology: state.topology
      });
    }

    const worker = new Worker(new URL("../engine/sim.worker.ts", import.meta.url));
    worker.onmessage = (
      event: MessageEvent<{
        type: string;
        frame?: Uint8Array;
        simulatedMillis?: number;
        error?: string;
        source?: string;
        event?: string;
        data?: Record<string, unknown>;
      }>
    ) => {
      const data = event.data;
      if (data.type === "frame" && data.frame) {
        frameRef.current = data.frame;
        frameCountRef.current += 1;
        if (DEBUG_SIM && frameCountRef.current % 30 === 0) {
          pushDiag("[StudioShell] frame received", {
            simulatedMillis: data.simulatedMillis ?? 0,
            frameSize: data.frame.length,
            frameHead: [data.frame[0] ?? 0, data.frame[1] ?? 0, data.frame[2] ?? 0],
            engineError: data.error ?? ""
          });
        }
        state.setFrame(data.frame, data.simulatedMillis ?? 0, data.error ?? "");
        return;
      }
      if (data.type === "diag") {
        pushDiag(`[${data.source ?? "worker"}] ${data.event ?? "diag"}`, data.data ?? {});
      }
    };
    worker.onerror = (error) => {
      console.error("[StudioShell] worker error", error.message, error);
      pushDiag("[StudioShell] worker error", { message: error.message });
    };

    if (DEBUG_SIM) {
      pushDiag("[StudioShell] postMessage:init", {
        ledCount: state.topology.ledCount,
        simTickRate: state.simulation.simTickRate
      });
    }
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
      if (DEBUG_SIM) {
        pushDiag("[StudioShell] teardown");
      }
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      worker.terminate();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.updateTopology(state.topology);
    if (DEBUG_SIM) {
      pushDiag("[StudioShell] postMessage:topology", { ledCount: state.topology.ledCount, topology: state.topology });
    }
    workerRef.current?.postMessage({ type: "topology", ledCount: state.topology.ledCount });
  }, [state.topology]);

  const commandPayload = useMemo(() => {
    const command = state.command;
    const selectedIndex = state.ui.selectedSegmentIndex;
    if (!Array.isArray(command.seg) || command.seg.length <= 1) {
      return JSON.stringify(command);
    }

    const safeIndex = Math.max(0, Math.min(command.seg.length - 1, selectedIndex));
    if (safeIndex === 0) {
      return JSON.stringify(command);
    }

    const reordered = [...command.seg];
    const [selected] = reordered.splice(safeIndex, 1);
    if (selected) {
      reordered.unshift(selected);
    }
    return JSON.stringify({
      ...command,
      seg: reordered
    });
  }, [state.command, state.ui.selectedSegmentIndex]);
  useEffect(() => {
    if (DEBUG_SIM) {
      pushDiag("[StudioShell] postMessage:json", {
        payloadPreview: commandPayload.slice(0, 220)
      });
    }
    workerRef.current?.postMessage({ type: "json", payload: commandPayload });
  }, [commandPayload]);

  useEffect(() => {
    if (DEBUG_SIM) {
      pushDiag("[StudioShell] postMessage:running", { running: state.simulation.running });
    }
    workerRef.current?.postMessage({ type: "running", running: state.simulation.running });
  }, [state.simulation.running]);

  const onReset = () => {
    if (DEBUG_SIM) {
      pushDiag("[StudioShell] postMessage:reset");
    }
    state.resetClock();
    workerRef.current?.postMessage({ type: "reset" });
  };

  return (
    <main className="studioDashboard">
      <TopBar
        running={state.simulation.running}
        onToggleRunning={() => state.setRunning(!state.simulation.running)}
        onResetClock={onReset}
        onExport={() => exportCfgAndPresets(state.topology, state.command)}
      />

      <LedConfigCard
        topology={state.topology}
        onModeChange={state.setMode}
        onDimensionsChange={state.setDimensions}
        onLedCountChange={state.setLedCount}
        onSerpentineChange={state.setSerpentine}
        onGapsChange={state.setGaps}
      />

      <LedViewCard
        canvasRef={canvasRef}
        ledCount={state.topology.ledCount}
        simulatedMillis={state.simulatedMillis}
        simTickRate={state.simulation.simTickRate}
        lastError={state.lastError}
      />

      <ControlDeck
        command={state.command}
        selectedSegmentIndex={state.ui.selectedSegmentIndex}
        segmentCount={Array.isArray(state.command.seg) ? state.command.seg.length : 1}
        setControl={state.setControl}
        setColorScheme={state.setColorScheme}
        setSegmentColor={state.setSegmentColor}
        setSegmentName={state.setSegmentName}
        setSegmentNumericField={state.setSegmentNumericField}
        setSegmentBooleanField={state.setSegmentBooleanField}
        setSelectedSegment={state.setSelectedSegment}
        addSegment={state.addSegment}
        removeSelectedSegment={state.removeSelectedSegment}
      />

      <UtilityDrawer open={state.ui.drawerOpen} onToggle={state.toggleDrawer}>
        <div className="utilityStatusGrid">
          <span>LEDs: {state.topology.ledCount}</span>
          <span>Sim time: {state.simulatedMillis}ms</span>
          <span>Target sim: {state.simulation.simTickRate} TPS</span>
          <span className={state.lastError ? "errorText" : "okText"}>{state.lastError ? state.lastError : "No engine errors"}</span>
        </div>
        {DEBUG_SIM ? <pre className="diagLog">{diagLines.length > 0 ? diagLines.join("\n") : "No diagnostics yet"}</pre> : null}
        <div className="utilityPanels">
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
        </div>
      </UtilityDrawer>
    </main>
  );
}
