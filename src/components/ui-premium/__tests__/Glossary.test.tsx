import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Glossary } from '../Glossary';
import { glossario } from '@/content/glossario';

describe('Glossary', () => {
  it('renderiza o termo do glossário pela chave', () => {
    render(<Glossary termKey="medicao" />);
    expect(screen.getByText(glossario.medicao.term)).toBeInTheDocument();
  });

  it('aceita label customizado via children', () => {
    render(<Glossary termKey="rdo">RDO de hoje</Glossary>);
    expect(screen.getByText('RDO de hoje')).toBeInTheDocument();
  });

  it('expõe definição via aria-label para screen readers', () => {
    render(<Glossary termKey="leadTime" />);
    const trigger = screen.getByRole('button', {
      name: new RegExp(glossario.leadTime.term, 'i'),
    });
    const aria = trigger.getAttribute('aria-label') ?? '';
    expect(aria).toContain(glossario.leadTime.term);
    expect(aria).toContain(glossario.leadTime.definition);
  });

  it('é navegável por teclado (focável)', () => {
    render(<Glossary termKey="bdi" />);
    const trigger = screen.getByRole('button');
    // botão nativo é focável por padrão; checa que não foi marcado como tabIndex=-1
    expect(trigger.getAttribute('tabindex')).not.toBe('-1');
  });

  it('faz fallback gracioso para termo desconhecido', () => {
    // @ts-expect-error — testando defesa contra chave inválida
    render(<Glossary termKey="termo_inexistente">Texto bruto</Glossary>);
    expect(screen.getByText('Texto bruto')).toBeInTheDocument();
  });

  it('esconde o ícone quando hideIcon=true', () => {
    const { container } = render(<Glossary termKey="art" hideIcon />);
    expect(container.querySelectorAll('svg').length).toBe(0);
  });
});
