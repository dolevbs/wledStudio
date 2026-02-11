import * as THREE from "three";
import type { StudioTopology } from "@/types/studio";
import { buildLedPositions, buildPhysicalIndexMap } from "@/rendering/topology";

export class StudioRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private mesh: THREE.InstancedMesh | null = null;
  private topology: StudioTopology;

  constructor(canvas: HTMLCanvasElement, topology: StudioTopology) {
    this.canvas = canvas;
    this.topology = topology;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setClearColor(0x0b0f14, 1);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 1000);
    this.camera.position.set(0, 0, 48);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5, 12, 8);
    this.scene.add(keyLight);

    const fillLight = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(fillLight);

    this.rebuildMesh(topology);
  }

  updateTopology(topology: StudioTopology): void {
    this.topology = topology;
    this.rebuildMesh(topology);
  }

  updateFrame(buffer: Uint8Array): void {
    if (!this.mesh) {
      return;
    }

    const color = new THREE.Color();
    const instanceCount = Math.min(this.topology.ledCount, Math.floor(buffer.length / 3));

    for (let i = 0; i < instanceCount; i += 1) {
      const offset = i * 3;
      color.setRGB(buffer[offset] / 255, buffer[offset + 1] / 255, buffer[offset + 2] / 255);
      this.mesh.setColorAt(i, color);
    }

    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    this.renderer.dispose();
  }

  private rebuildMesh(topology: StudioTopology): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }

    const physicalIndexMap = buildPhysicalIndexMap(topology.ledCount, topology.gaps);
    const withMap = { ...topology, physicalIndexMap };
    const positions = buildLedPositions(withMap);

    const geometry = new THREE.SphereGeometry(0.38, 10, 10);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.25,
      metalness: 0.1,
      emissiveIntensity: 1.1,
      vertexColors: true
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, topology.ledCount);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < positions.length; i += 1) {
      const [x, y, z] = positions[i];
      matrix.makeTranslation(x, y, z);
      this.mesh.setMatrixAt(i, matrix);
      this.mesh.setColorAt(i, new THREE.Color(0, 0, 0));
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }

    this.scene.add(this.mesh);

    const spread = topology.mode === "matrix" ? Math.max(topology.width, topology.height) : Math.max(16, topology.ledCount / 8);
    this.camera.position.set(0, 0, Math.max(16, spread * 1.6));
    this.camera.lookAt(0, 0, 0);
  }
}
