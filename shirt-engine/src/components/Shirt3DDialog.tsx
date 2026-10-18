import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Camera, Pause, Play, Video, X } from 'lucide-react';
import type { Project } from '../model/project';
import { buildShirtModel, type ShirtModel } from '../three/buildShirt';
import { safeFileName, storage } from '../io/storage';

const VIEWS = [
  { label: 'Front', az: 0 },
  { label: "Wearer's left", az: Math.PI / 2 },
  { label: 'Back', az: Math.PI },
  { label: "Wearer's right", az: -Math.PI / 2 },
];

/** Rotating 3D preview built from the current design (see three/buildShirt). */
export function Shirt3DDialog({ project, onClose, say }: { project: Project; onClose(): void; say(t: string, k?: 'info' | 'error'): void }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ renderer: THREE.WebGLRenderer; controls: OrbitControls; camera: THREE.PerspectiveCamera; model: ShirtModel } | null>(null);
  const [status, setStatus] = useState<'building' | 'ready' | 'error'>('building');
  const [spin, setSpin] = useState(true);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let disposed = false, frame = 0;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x2a2e34);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    camera.position.set(0, 0.05, 2.6);
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(0.4, 0.6, 1);
    camera.add(key); // light follows the camera so the shirt is never in the dark
    scene.add(camera);

    // Soft floor shadow.
    const sh = document.createElement('canvas');
    sh.width = sh.height = 128;
    const sg = sh.getContext('2d')!;
    const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.9;
    controls.maxDistance = 5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    buildShirtModel(project).then(model => {
      if (disposed) { model.dispose(); return; }
      scene.add(model.group);
      shadow.position.y = -model.size.h / 2 - 0.02;
      shadow.scale.set(1, model.size.depth * 2.2, 1);
      controls.target.set(0, 0, 0);
      camera.position.set(0, 0.05, Math.max(2.2, model.size.h * 2.3));
      api.current = { renderer, controls, camera, model };
      setStatus('ready');
    }, e => { console.error(e); if (!disposed) setStatus('error'); });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      api.current?.model.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // Built once per opening; close and reopen to rebuild after edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (api.current) api.current.controls.autoRotate = spin && !recording; }, [spin, recording, status]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !recording) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, recording]);

  function goTo(az: number) {
    const a = api.current;
    if (!a) return;
    setSpin(false);
    const dist = a.camera.position.distanceTo(a.controls.target);
    a.camera.position.set(Math.sin(az) * dist, a.camera.position.y, Math.cos(az) * dist);
    a.controls.update();
  }

  async function snapshot() {
    const a = api.current;
    if (!a) return;
    const blob = await new Promise<Blob | null>(r => a.renderer.domElement.toBlob(r, 'image/png'));
    if (blob) await storage.saveExport(blob, `${safeFileName(project.name)}-3d.png`);
  }

  /** Records one full turn (6 s) as a WebM video. */
  async function record360() {
    const a = api.current;
    if (!a || recording) return;
    const canvas = a.renderer.domElement;
    const mime = ['video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) return say('Video recording is not supported in this browser.', 'error');
    setRecording(true);
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>(r => { rec.onstop = () => r(); });
    const dist = a.camera.position.distanceTo(a.controls.target), y = a.camera.position.y;
    const start = performance.now(), DURATION = 6000;
    rec.start();
    await new Promise<void>(resolve => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / DURATION);
        const az = t * Math.PI * 2;
        a.camera.position.set(Math.sin(az) * dist, y, Math.cos(az) * dist);
        a.controls.update();
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      step();
    });
    rec.stop();
    await done;
    setRecording(false);
    await storage.saveExport(new Blob(chunks, { type: 'video/webm' }), `${safeFileName(project.name)}-360.webm`);
  }

  return (
    <div className="modalBack" onMouseDown={e => { if (e.target === e.currentTarget && !recording) onClose(); }}>
      <div className="modal viewer3d" role="dialog" aria-label="3D preview">
        <div className="modalHead">
          <h3>3D preview</h3>
          <button aria-label="Close" disabled={recording} onClick={onClose}><X size={16} /></button>
        </div>
        <div ref={host} className="stage3d">
          {status !== 'ready' && <div className="overlay3d">{status === 'building' ? 'Building 3D shirt…' : 'Could not build the 3D preview (WebGL unavailable?).'}</div>}
        </div>
        <div className="btnRow">
          <button onClick={() => setSpin(s => !s)} disabled={recording}>{spin ? <Pause size={15} /> : <Play size={15} />} {spin ? 'Pause' : 'Spin'}</button>
          {VIEWS.map(v => <button key={v.label} onClick={() => goTo(v.az)} disabled={recording || status !== 'ready'}>{v.label}</button>)}
          <span className="grow" />
          <button onClick={snapshot} disabled={status !== 'ready' || recording}><Camera size={15} /> Snapshot</button>
          <button className="primary" onClick={record360} disabled={status !== 'ready' || recording}><Video size={15} /> {recording ? 'Recording…' : '360° video'}</button>
        </div>
        <p className="muted tiny">Drag to rotate · scroll to zoom. Illustrative 3D built from the front and back views — not a tailored garment model.</p>
      </div>
    </div>
  );
}
