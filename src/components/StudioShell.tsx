"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ControlDeck } from "@/components/ControlDeck";
import { exportCfgAndPresets, ImportExportPanel } from "@/components/ImportExportPanel";
import { JsonPanel } from "@/components/JsonPanel";
import { LedViewCard } from "@/components/LedViewCard";
import { projectSceneToViewport } from "@/rendering/visualizerViewport";
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
  const resizeVersionRef = useRef(0);
  const resizeRafRef = useRef<number | null>(null);
  const lastResizeMismatchLogRef = useRef(0);
  const viewportMetricsRef = useRef<{ width: number; height: number }>({ width: 1, height: 1 });
  const [diagLines, setDiagLines] = useState<string[]>([]);
  const [viewportMetrics, setViewportMetrics] = useState<{ width: number; height: number }>({ width: 1, height: 1 });

  const state = useStudioStore();

  const pushDiag = (line: string, data?: Record<string, unknown>) => {
    const now = new Date().toISOString().slice(11, 23);
    const formatted = data ? `${now} ${line} ${JSON.stringify(data)}` : `${now} ${line}`;
    console.log("[diag]", formatted);
    setDiagLines((prev) => [...prev.slice(-9), formatted]);
  };

  const scheduleRendererResize = useCallback(() => {
    resizeVersionRef.current += 1;
    if (resizeRafRef.current !== null) {
      window.cancelAnimationFrame(resizeRafRef.current);
    }
    resizeRafRef.current = window.requestAnimationFrame(() => {
      rendererRef.current?.resize();
      resizeRafRef.current = null;
    });
  }, []);

  const onViewportMetrics = useCallback(
    (metrics: { width: number; height: number }) => {
      setViewportMetrics((prev) => {
        if (prev.width === metrics.width && prev.height === metrics.height) return prev;
        viewportMetricsRef.current = metrics;
        return metrics;
      });
      scheduleRendererResize();
    },
    [scheduleRendererResize]
  );

  useEffect(() => {
    viewportMetricsRef.current = viewportMetrics;
  }, [viewportMetrics]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const widthDiff = Math.abs(canvas.clientWidth - viewportMetrics.width);
    const heightDiff = Math.abs(canvas.clientHeight - viewportMetrics.height);
    if (widthDiff <= 1 && heightDiff <= 1) return;
    const now = Date.now();
    if (DEBUG_SIM && now - lastResizeMismatchLogRef.current > 200) {
      pushDiag("[StudioShell] viewport/canvas mismatch detected", {
        canvasClient: { width: canvas.clientWidth, height: canvas.clientHeight },
        viewportMetrics
      });
      lastResizeMismatchLogRef.current = now;
    }
    scheduleRendererResize();
  }, [viewportMetrics, scheduleRendererResize]);

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

    let animationFrame = 0;
    const renderLoop = () => {
      const frameVersion = resizeVersionRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        const metrics = viewportMetricsRef.current;
        const widthDiff = Math.abs(canvas.clientWidth - metrics.width);
        const heightDiff = Math.abs(canvas.clientHeight - metrics.height);
        if (widthDiff > 1 || heightDiff > 1) {
          const now = Date.now();
          if (DEBUG_SIM && now - lastResizeMismatchLogRef.current > 200) {
            pushDiag("[StudioShell] render-loop resize self-heal", {
              canvasClient: { width: canvas.clientWidth, height: canvas.clientHeight },
              viewportMetrics: metrics
            });
            lastResizeMismatchLogRef.current = now;
          }
          scheduleRendererResize();
        }
      }
      rendererRef.current?.updateFrame(frameRef.current);
      if (frameVersion !== resizeVersionRef.current) {
        animationFrame = window.requestAnimationFrame(renderLoop);
        return;
      }
      rendererRef.current?.render();
      animationFrame = window.requestAnimationFrame(renderLoop);
    };
    animationFrame = window.requestAnimationFrame(renderLoop);

    return () => {
      if (DEBUG_SIM) {
        pushDiag("[StudioShell] teardown");
      }
      window.cancelAnimationFrame(animationFrame);
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      worker.terminate();
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [scheduleRendererResize]);

  useEffect(() => {
    rendererRef.current?.updateTopology(state.topology);
    if (DEBUG_SIM) {
      pushDiag("[StudioShell] postMessage:topology", { ledCount: state.topology.ledCount, topology: state.topology });
    }
    workerRef.current?.postMessage({ type: "topology", ledCount: state.topology.ledCount });
  }, [state.topology]);

  const commandPayload = useMemo(() => JSON.stringify(state.command), [state.command]);
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

  useEffect(() => {
    state.tickPlaylist(state.simulatedMillis);
  }, [state.simulatedMillis, state.tickPlaylist]);

  const viewportAdjustedDerivedPositions = useMemo(
    () =>
      state.visualization.derivedPositions.map(([x, y, z]) => {
        const [sx, sy] = projectSceneToViewport([x, y], state.visualization.viewport, viewportMetrics.width, viewportMetrics.height);
        return [sx, sy, z] as [number, number, number];
      }),
    [state.visualization.derivedPositions, state.visualization.viewport, viewportMetrics]
  );

  useEffect(() => {
    rendererRef.current?.setOverridePositions(state.visualization.enabled ? viewportAdjustedDerivedPositions : null, "screen");
  }, [state.visualization.enabled, viewportAdjustedDerivedPositions]);

  useEffect(() => {
    rendererRef.current?.setLedOpacity(state.visualization.ledOpacity);
  }, [state.visualization.ledOpacity]);

  useEffect(() => {
    rendererRef.current?.setBackgroundActive(Boolean(state.visualization.background));
  }, [state.visualization.background]);

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
        onExport={() => exportCfgAndPresets(state.topology, state.command, state.presets)}
      />

      <LedViewCard
        canvasRef={canvasRef}
        ledCount={state.topology.ledCount}
        simulatedMillis={state.simulatedMillis}
        simTickRate={state.simulation.simTickRate}
        lastError={state.lastError}
        visualization={state.visualization}
        segmentCount={Array.isArray(state.command.seg) ? state.command.seg.length : 1}
        ledViewHeightPx={state.ui.ledViewHeightPx}
        setLedViewHeight={state.setLedViewHeight}
        addSegment={state.addSegment}
        setVisualizationEnabled={state.setVisualizationEnabled}
        setVisualizationLedOpacity={state.setVisualizationLedOpacity}
        setVisualizationBackground={state.setVisualizationBackground}
        setVisualizationViewport={state.setVisualizationViewport}
        resetVisualizationViewport={state.resetVisualizationViewport}
        startVisualizationStrip={state.startVisualizationStrip}
        addVisualizationPoint={state.addVisualizationPoint}
        finishVisualizationStrip={state.finishVisualizationStrip}
        cancelVisualizationStrip={state.cancelVisualizationStrip}
        removeVisualizationStrip={state.removeVisualizationStrip}
        setStripSegmentAllocations={state.setStripSegmentAllocations}
        updateVisualizationStripLedCount={state.updateVisualizationStripLedCount}
        importVisualizationProject={state.importVisualizationProject}
        exportVisualizationProject={state.exportVisualizationProject}
        onViewportMetrics={onViewportMetrics}
      />

      <ControlDeck
        command={state.command}
        selectedSegmentIndex={state.ui.selectedSegmentIndex}
        segmentCount={Array.isArray(state.command.seg) ? state.command.seg.length : 1}
        presets={state.presets}
        setControl={state.setControl}
        setControlAt={state.setControlAt}
        setColorScheme={state.setColorScheme}
        setSegmentColor={state.setSegmentColor}
        setSegmentName={state.setSegmentName}
        setSegmentNumericField={state.setSegmentNumericField}
        setSegmentBooleanField={state.setSegmentBooleanField}
        setSelectedSegment={state.setSelectedSegment}
        addSegment={state.addSegment}
        removeSegmentAt={state.removeSegmentAt}
        savePreset={state.savePreset}
        deletePreset={state.deletePreset}
        applyPreset={state.applyPreset}
        setPresetQuickLabel={state.setPresetQuickLabel}
        setPlaylistForPreset={state.setPlaylistForPreset}
        clearPlaylistForPreset={state.clearPlaylistForPreset}
        startPlaylist={state.startPlaylist}
        stopPlaylist={state.stopPlaylist}
        advancePlaylist={state.advancePlaylist}
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
              presets: state.presets,
              replaceTopology: state.replaceTopology,
              replaceCommand: state.replaceCommand,
              replacePresetLibrary: state.replacePresetLibrary
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
