import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProjectStatusBadge } from '@/components/portfolio/ProjectStatusBadge';

const FUTURE = '2099-12-31';
const PAST = '2000-01-01';

describe('ProjectStatusBadge', () => {
  it('renders the human label for an active project', () => {
    const { getByText } = render(
      <ProjectStatusBadge project={{ status: 'active', planned_end_date: FUTURE }} />,
    );
    expect(getByText('Ativa')).toBeInTheDocument();
  });

  it('renders the human label for paused / completed / draft / cancelled', () => {
    const cases: Array<[string, string]> = [
      ['paused', 'Pausada'],
      ['completed', 'Concluída'],
      ['draft', 'Rascunho'],
      ['cancelled', 'Cancelada'],
    ];
    for (const [status, label] of cases) {
      const { getByText } = render(<ProjectStatusBadge project={{ status }} />);
      expect(getByText(label)).toBeInTheDocument();
    }
  });

  it('falls back to the raw status string for unknown values', () => {
    const { getByText } = render(<ProjectStatusBadge project={{ status: 'unicorn' }} />);
    expect(getByText('unicorn')).toBeInTheDocument();
  });

  it('promotes label to "Atrasada" when an active project is past its planned end', () => {
    const { getByText, queryByText } = render(
      <ProjectStatusBadge project={{ status: 'active', planned_end_date: PAST }} />,
    );
    expect(getByText('Atrasada')).toBeInTheDocument();
    expect(queryByText('Ativa')).toBeNull();
  });

  it('does NOT show "Atrasada" once the project actually finished', () => {
    const { getByText, queryByText } = render(
      <ProjectStatusBadge
        project={{
          status: 'active',
          planned_end_date: PAST,
          actual_end_date: PAST,
        }}
      />,
    );
    expect(getByText('Ativa')).toBeInTheDocument();
    expect(queryByText('Atrasada')).toBeNull();
  });

  it('does NOT show "Atrasada" for non-active statuses even past the deadline', () => {
    const { getByText, queryByText } = render(
      <ProjectStatusBadge project={{ status: 'paused', planned_end_date: PAST }} />,
    );
    expect(getByText('Pausada')).toBeInTheDocument();
    expect(queryByText('Atrasada')).toBeNull();
  });
});
