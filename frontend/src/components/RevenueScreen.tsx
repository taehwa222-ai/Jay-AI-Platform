import { DollarOutlined } from '@ant-design/icons';
import type { MonetizationIdea } from '../types';
import { SectionTitle } from './shared';

export function RevenueScreen({ active, ideas }: { active: boolean; ideas: MonetizationIdea[] }) {
  return (
    <section className={active ? 'section-block' : 'screen-hidden'} id="revenue">
      <SectionTitle eyebrow="Revenue Lab" icon={<DollarOutlined />} title="수익 창출 아이디어" />
      <div className="idea-grid">
        {ideas.map((idea) => (
          <article className="idea-card" key={idea.id}>
            <h3>{idea.title}</h3>
            <dl>
              <dt>모델</dt>
              <dd>{idea.model}</dd>
              <dt>주의</dt>
              <dd>{idea.risk}</dd>
              <dt>다음 작업</dt>
              <dd>{idea.next_step}</dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
