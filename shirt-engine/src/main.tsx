import { createRoot } from 'react-dom/client';
import { App } from './App';
import { renderToCanvas } from './render/exportImage';
import { newProject, parseProject, recropLayer, serializeProject } from './model/project';
import './style.css';

// Hooks for automated smoke tests (scripts/smoke-export.cjs).
(window as any).mdshirtDebug = { renderToCanvas, newProject, parseProject, serializeProject, recropLayer };

createRoot(document.getElementById('root')!).render(<App />);
