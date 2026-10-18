// Editor preview of the base shirt pattern: the same canvas the exporter
// uses, multiplied onto the master.
import { useEffect, useState } from 'react';
import { Image as KImage } from 'react-konva';
import type { Project } from '../model/project';
import { MASTER_W, MASTER_H } from '../model/zones';
import { buildPatternCanvas } from './pattern';

export function PatternLayer({ project }: { project: Project; master: HTMLImageElement | null }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const pattern = project.pattern;
  useEffect(() => {
    let live = true;
    buildPatternCanvas(project).then(c => { if (live) setCanvas(c); }, () => { if (live) setCanvas(null); });
    return () => { live = false; };
    // Only the pattern settings (and the assets they use) affect this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern]);
  if (!canvas || !pattern) return null;
  return (
    <KImage
      image={canvas as unknown as HTMLImageElement}
      width={MASTER_W}
      height={MASTER_H}
      globalCompositeOperation="multiply"
      listening={false}
    />
  );
}
