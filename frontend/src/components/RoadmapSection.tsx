import { CheckCircleOutlined } from '@ant-design/icons';
import type { RoadmapPhase } from '../types';

export function RoadmapSection({ active, roadmap }: { active: boolean; roadmap: RoadmapPhase[] }) {
  return (
    <section className={active ? 'phase-list' : 'screen-hidden'} id="roadmap">
      {roadmap.map((phase) => (
        <article className="phase-card" key={phase.id}>
          <div className="phase-head">
            <h3>{phase.title}</h3>
            <span>{phase.status}</span>
          </div>
          <ul>
            {phase.items.map((item) => (
              <li key={item}>
                <CheckCircleOutlined />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
