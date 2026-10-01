import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FaqPage from '@/app/faq/page';
import { FaqView } from '@/components/faq/FaqView';

describe('FaqPage and FaqView (Issue #63)', () => {
  it('renders the complete FAQ page with Header, FaqView, and Footer', () => {
    render(<FaqPage />);

    // Header & Footer
    expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    // FaqView heading and subtitle
    expect(screen.getByRole('heading', { name: /^preguntas frecuentes$/i, level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(/encontrá respuestas rápidas sobre cómo operar en lencord/i)
    ).toBeInTheDocument();
  });

  it('renders accessible tablist with 3 tabs and General selected by default', () => {
    render(<FaqView />);

    const tabList = screen.getByRole('tablist', { name: /apartados de preguntas frecuentes/i });
    expect(tabList).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    const generalTab = screen.getByRole('tab', { name: /^general$/i });
    const pymesTab = screen.getByRole('tab', { name: /^para pymes$/i });
    const inversoresTab = screen.getByRole('tab', { name: /^para inversores$/i });

    expect(generalTab).toHaveAttribute('aria-selected', 'true');
    expect(pymesTab).toHaveAttribute('aria-selected', 'false');
    expect(inversoresTab).toHaveAttribute('aria-selected', 'false');

    // Default panel content for General
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-general');
    expect(screen.getByRole('heading', { name: /preguntas generales sobre lencord/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('faq-empty-placeholder')).toBeInTheDocument();
  });

  it('switches tabs and displays corresponding section content on click', () => {
    render(<FaqView />);

    const generalTab = screen.getByRole('tab', { name: /^general$/i });
    const pymesTab = screen.getByRole('tab', { name: /^para pymes$/i });
    const inversoresTab = screen.getByRole('tab', { name: /^para inversores$/i });

    // 1. Click Para PyMEs
    fireEvent.click(pymesTab);
    expect(pymesTab).toHaveAttribute('aria-selected', 'true');
    expect(generalTab).toHaveAttribute('aria-selected', 'false');
    expect(
      screen.getByRole('heading', { name: /financiamiento colectivo para pymes/i, level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/requisitos para solicitar crédito/i)).toBeInTheDocument();

    // 2. Click Para inversores
    fireEvent.click(inversoresTab);
    expect(inversoresTab).toHaveAttribute('aria-selected', 'true');
    expect(pymesTab).toHaveAttribute('aria-selected', 'false');
    expect(
      screen.getByRole('heading', { name: /inversión y rendimientos para inversores/i, level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText(/cómo participar en subastas de crédito/i)).toBeInTheDocument();

    // 3. Click back to General
    fireEvent.click(generalTab);
    expect(generalTab).toHaveAttribute('aria-selected', 'true');
    expect(inversoresTab).toHaveAttribute('aria-selected', 'false');
    expect(
      screen.getByRole('heading', { name: /preguntas generales sobre lencord/i, level: 2 })
    ).toBeInTheDocument();
  });

  it('supports WAI-ARIA keyboard navigation between tabs (ArrowRight, ArrowLeft, Home, End)', () => {
    render(<FaqView />);

    const generalTab = screen.getByRole('tab', { name: /^general$/i });
    const pymesTab = screen.getByRole('tab', { name: /^para pymes$/i });
    const inversoresTab = screen.getByRole('tab', { name: /^para inversores$/i });

    generalTab.focus();
    expect(document.activeElement).toBe(generalTab);

    // ArrowRight -> Para PyMEs
    fireEvent.keyDown(generalTab, { key: 'ArrowRight' });
    expect(pymesTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(pymesTab);

    // ArrowRight -> Para inversores
    fireEvent.keyDown(pymesTab, { key: 'ArrowRight' });
    expect(inversoresTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(inversoresTab);

    // ArrowRight -> wraps around to General
    fireEvent.keyDown(inversoresTab, { key: 'ArrowRight' });
    expect(generalTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(generalTab);

    // ArrowLeft -> wraps backwards to Para inversores
    fireEvent.keyDown(generalTab, { key: 'ArrowLeft' });
    expect(inversoresTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(inversoresTab);
  });

  it('renders support CTA banner with contact link', () => {
    render(<FaqView />);

    const supportBanner = screen.getByTestId('faq-support-banner');
    expect(supportBanner).toBeInTheDocument();
    expect(screen.getByText(/¿tenés una consulta específica\?/i)).toBeInTheDocument();

    const contactBtn = screen.getByRole('link', { name: /contactar a soporte/i });
    expect(contactBtn).toHaveAttribute('href', 'mailto:soporte@lencord.com');
  });
});
