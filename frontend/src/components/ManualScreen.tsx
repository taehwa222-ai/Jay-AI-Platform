import { BookOutlined } from '@ant-design/icons';
import type { ManualSection } from '../types';
import { SectionTitle } from './shared';

export function ManualScreen({ active, manual }: { active: boolean; manual: ManualSection[] }) {
  return (
    <section className={active ? 'section-block' : 'screen-hidden'} id="manual">
      <SectionTitle
        eyebrow="Manual Screen"
        icon={<BookOutlined />}
        title="로컬 개발부터 VPS 배포까지"
      />
      <div className="manual-list">
        {manual.map((section) => (
          <article className="manual-card" key={section.id}>
            <div>
              <h3>{section.title}</h3>
              <p>{section.summary}</p>
            </div>
            <div className="command-list">
              {section.commands.map((command) => (
                <code key={command}>{command}</code>
              ))}
            </div>
            <ul className="check-list">
              {section.checks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
