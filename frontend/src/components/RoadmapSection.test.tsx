import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoadmapSection } from './RoadmapSection';
import type { RoadmapPhase } from '../types';

const roadmap: RoadmapPhase[] = [
  {
    id: 'revenue',
    title: 'Revenue Modules',
    status: 'active',
    items: ['Korea stock lab', 'paid reports'],
  },
];

describe('RoadmapSection', () => {
  it('renders each phase title, status, and items', () => {
    render(<RoadmapSection active roadmap={roadmap} />);

    expect(screen.getByText('Revenue Modules')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('paid reports')).toBeInTheDocument();
  });

  it('uses the hidden class when not active', () => {
    const { container } = render(<RoadmapSection active={false} roadmap={roadmap} />);
    expect(container.querySelector('section')).toHaveClass('screen-hidden');
  });
});
