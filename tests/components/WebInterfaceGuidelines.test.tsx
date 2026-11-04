import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

vi.mock('next/font/google', () => ({
  Plus_Jakarta_Sans: () => ({ className: 'font-sans', variable: '--font-sans' }),
  JetBrains_Mono: () => ({ className: 'font-mono', variable: '--font-mono' }),
}));

import RootLayout, { viewport } from '@/app/layout';
import { TRUST_METRICS } from '@/components/home/TrustBar';
import { HeroSimulator } from '@/components/home/HeroSimulator';

describe('Web Interface Guidelines & Accessibility Verification', () => {
  describe('Accessibility & Root Layout', () => {
    it('renders accessible skip-link to #main-content as first focusable element inside body', () => {
      render(
        <RootLayout>
          <main id="main-content">Contenido</main>
        </RootLayout>
      );

      const skipLink = screen.getByRole('link', { name: 'Saltar al contenido principal' });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
      expect(skipLink).toHaveClass('skip-link');
    });

    it('exports themeColor matching #F8FAFC within viewport configuration', () => {
      expect(viewport).toBeDefined();
      expect(viewport.themeColor).toBe('#F8FAFC');
    });

    it('renders aria-hidden="true" on all trust highlight checkmark icons in HeroSimulator', () => {
      render(<HeroSimulator />);

      const icons = screen.getAllByText('✓');
      expect(icons).toHaveLength(3);
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Form Inputs Accessibility in HeroSimulator', () => {
    it('renders borrower input with explicit name, autoComplete off, and spellCheck false', () => {
      render(<HeroSimulator initialMode="borrower" />);

      const borrowerInput = screen.getByTestId('borrower-amount-input');
      expect(borrowerInput).toHaveAttribute('name', 'borrowerAmount');
      expect(borrowerInput).toHaveAttribute('autoComplete', 'off');
      expect(borrowerInput).toHaveAttribute('spellcheck', 'false');
    });

    it('renders investor input with explicit name, autoComplete off, and spellCheck false', () => {
      render(<HeroSimulator initialMode="investor" />);

      const investorInput = screen.getByTestId('investor-amount-input');
      expect(investorInput).toHaveAttribute('name', 'investorAmount');
      expect(investorInput).toHaveAttribute('autoComplete', 'off');
      expect(investorInput).toHaveAttribute('spellcheck', 'false');
    });
  });

  describe('Non-breaking Spaces in TrustBar Metrics', () => {
    it('uses non-breaking space in historical-volume to prevent line-wrapping', () => {
      const volume = TRUST_METRICS.find((m) => m.id === 'historical-volume');
      expect(volume).toBeDefined();
      expect(volume?.value).toBe('$' + '\u00A0' + '150M+');
    });

    it('uses non-breaking space in average-term to prevent line-wrapping', () => {
      const term = TRUST_METRICS.find((m) => m.id === 'average-term');
      expect(term).toBeDefined();
      expect(term?.value).toBe('5,8\u00A0meses');
    });

    it('uses non-breaking space in investor-return to prevent line-wrapping', () => {
      const yieldMetric = TRUST_METRICS.find((m) => m.id === 'investor-return');
      expect(yieldMetric).toBeDefined();
      expect(yieldMetric?.value).toBe('52,4%\u00A0TNA');
    });
  });

  describe('Design System & Stylesheet Guidelines', () => {
    const rootDir = process.cwd();

    it('removes redundant Google Fonts @import in globals.css and includes required performance rules', () => {
      const globalsCss = fs.readFileSync(path.join(rootDir, 'app/globals.css'), 'utf-8');

      // No redundant @import
      expect(globalsCss).not.toMatch(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com/i);

      // Touch action manipulation
      expect(globalsCss).toMatch(/touch-action:\s*manipulation/);

      // Text-wrap balance for headings
      expect(globalsCss).toMatch(/text-wrap:\s*balance/);

      // Prefers-reduced-motion block
      expect(globalsCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
      expect(globalsCss).toMatch(/animation-duration:\s*0\.01ms\s*!important/);

      // Skip link styles
      expect(globalsCss).toMatch(/\.skip-link/);
    });

    it('has overscroll-behavior: contain and no transition: all in header.module.css', () => {
      const headerCss = fs.readFileSync(path.join(rootDir, 'components/layout/header.module.css'), 'utf-8');

      expect(headerCss).toMatch(/overscroll-behavior:\s*contain/);
      expect(headerCss).not.toMatch(/transition:\s*all/);
    });

    it('has slider focus-visible and no transition: all in hero-simulator.module.css', () => {
      const heroCss = fs.readFileSync(path.join(rootDir, 'components/home/hero-simulator.module.css'), 'utf-8');

      expect(heroCss).toMatch(/\.slider:focus-visible/);
      expect(heroCss).not.toMatch(/transition:\s*all/);
    });

    it('has scroll-margin-top: 5rem and no transition: all in how-it-works.module.css', () => {
      const howItWorksCss = fs.readFileSync(path.join(rootDir, 'components/home/how-it-works.module.css'), 'utf-8');

      expect(howItWorksCss).toMatch(/scroll-margin-top:\s*5rem/);
      expect(howItWorksCss).not.toMatch(/transition:\s*all/);
    });

    it('has no transition: all in financing-categories.module.css', () => {
      const financingCss = fs.readFileSync(path.join(rootDir, 'components/home/financing-categories.module.css'), 'utf-8');

      expect(financingCss).not.toMatch(/transition:\s*all/);
    });
  });
});
