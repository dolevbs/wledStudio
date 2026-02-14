import { afterEach, describe, expect, it } from "vitest";

import { STUDIO_STATE_STORAGE_KEY, useStudioStore } from "../src/state/studioStore";

type PersistStorageLike = {
  getItem: (name: string) => { state: Record<string, unknown>; version: number } | null | Promise<{ state: Record<string, unknown>; version: number } | null>;
  setItem: (name: string, value: { state: Record<string, unknown>; version: number }) => void | Promise<void>;
};

function storage() {
  const persist = useStudioStore.persist;
  const options = persist.getOptions();
  return options.storage as PersistStorageLike;
}

afterEach(async () => {
  useStudioStore.getState().resetState();
  await useStudioStore.persist.rehydrate();
});

describe("studio store persistence", () => {
  it("persists and rehydrates persisted slices", async () => {
    const state = useStudioStore.getState();
    state.setLedCount(321);
    state.setRunning(false);
    state.setVisualizationLedOpacity(0.55);
    const persisted = await storage().getItem(STUDIO_STATE_STORAGE_KEY);
    expect(persisted).toBeTruthy();

    useStudioStore.setState((prev) => ({
      topology: { ...prev.topology, ledCount: 10, width: 10 },
      simulation: { ...prev.simulation, running: true },
      visualization: { ...prev.visualization, ledOpacity: 0.2 }
    }));
    await storage().setItem(STUDIO_STATE_STORAGE_KEY, persisted!);

    await useStudioStore.persist.rehydrate();

    const next = useStudioStore.getState();
    expect(next.topology.ledCount).toBe(321);
    expect(next.simulation.running).toBe(false);
    expect(next.visualization.ledOpacity).toBeCloseTo(0.55, 6);
  });

  it("does not persist transient slices", async () => {
    useStudioStore.setState({
      frame: new Uint8Array([1, 2, 3]),
      lastError: "boom",
      warnings: ["warn"]
    });

    const persisted = await storage().getItem(STUDIO_STATE_STORAGE_KEY);
    expect(persisted).toBeTruthy();

    const persistedState = persisted?.state ?? {};
    expect("frame" in persistedState).toBe(false);
    expect("lastError" in persistedState).toBe(false);
    expect("warnings" in persistedState).toBe(false);
  });

  it("resets background visibility to shown after rehydrate", async () => {
    const state = useStudioStore.getState();
    state.setVisualizationBackground({
      name: "bg.png",
      dataUrl: "data:image/png;base64,abc",
      width: 10,
      height: 10
    });
    state.setVisualizationBackgroundVisible(false);

    const persisted = await storage().getItem(STUDIO_STATE_STORAGE_KEY);
    expect(persisted).toBeTruthy();

    useStudioStore.setState((prev) => ({
      visualization: { ...prev.visualization, backgroundVisible: true }
    }));
    await storage().setItem(STUDIO_STATE_STORAGE_KEY, persisted!);
    await useStudioStore.persist.rehydrate();

    const next = useStudioStore.getState();
    expect(next.visualization.background).toBeTruthy();
    expect(next.visualization.backgroundVisible).toBe(true);
  });

  it("resetState restores defaults and clears persisted key", async () => {
    const state = useStudioStore.getState();
    state.setLedCount(300);
    state.setRunning(false);
    state.setFrame(new Uint8Array([1, 2, 3]), 999, "engine error");

    expect(await storage().getItem(STUDIO_STATE_STORAGE_KEY)).toBeTruthy();

    state.resetState();

    const next = useStudioStore.getState();
    expect(next.topology.ledCount).toBe(150);
    expect(next.simulation.running).toBe(true);
    expect(next.lastError).toBe("");
    expect(next.simulatedMillis).toBe(0);
    expect(await storage().getItem(STUDIO_STATE_STORAGE_KEY)).toBeNull();
  });

  it("hydrates safely from older persisted version", async () => {
    await storage().setItem(STUDIO_STATE_STORAGE_KEY, {
      version: 0,
      state: {
        topology: {
          mode: "strip",
          ledCount: 42,
          width: 42,
          height: 1,
          serpentine: false,
          gaps: []
        }
      }
    });

    await useStudioStore.persist.rehydrate();

    const next = useStudioStore.getState();
    expect(next.topology.ledCount).toBe(42);
    expect(next.command).toBeTruthy();
    expect(next.visualization).toBeTruthy();
  });
});
