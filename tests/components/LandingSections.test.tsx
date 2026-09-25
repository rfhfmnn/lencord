import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrustBar, TRUST_METRICS } from '@/components/home/TrustBar';
import { HowItWorks, PYME_STEPS, INVESTOR_STEPS } from '@/components/home/HowItWorks';
import { FinancingCategories, FINANCING_CATEGORIES } from '@/components/home/FinancingCategories';
import Home from '@/app/page';

describe('Landing Page Trust Metrics and Informational Sections (Task 8)', () => {
  describe('TrustBar Component', () => {
    it('renders all 4 key metrics with values, labels, and subtexts', () => {
      render(<TrustBar />);

      // Metric 1: total PyMEs financed
      const pymesMetric = screen.getByTestId('metric-pymes-financed');
      expect(pymesMetric).toHaveTextContent('+150');
      expect(pymesMetric).toHaveTextContent('PyMEs financiadas');

      // Metric 2: historical volume operated
      const volumeMetric = screen.getByTestId('metric-historical-volume');
      expect(volumeMetric).toHaveTextContent('$ 1.250M+');
      expect(volumeMetric).toHaveTextContent('Volumen operado');

      // Metric 3: average financing term
      const termMetric = screen.getByTestId('metric-average-term');
      expect(termMetric).toHaveTextContent('5,8 meses');
      expect(termMetric).toHaveTextContent('Plazo promedio');

      // Metric 4: average historical investor return (last 6 months)
      const returnMetric = screen.getByTestId('metric-investor-return');
      expect(returnMetric).toHaveTextContent('52,4% TNA');
      expect(returnMetric).toHaveTextContent('Rendimiento promedio');
      expect(returnMetric).toHaveTextContent('Retorno histórico últimos 6 meses');
    });

    it('accepts custom metrics list via props', () => {
      const customMetrics = [
        { id: 'custom-1', value: '100%', label: 'Seguridad', subtext: 'Pagaré digital' },
      ];
      render(<TrustBar metrics={customMetrics} />);

      expect(screen.getByTestId('metric-custom-1')).toHaveTextContent('100%');
      expect(screen.getByTestId('metric-custom-1')).toHaveTextContent('Seguridad');
    });
  });

  describe('HowItWorks Component', () => {
    it('renders interactive tabs switching between "Para PyMEs" and "Para Inversores"', () => {
      render(<HowItWorks />);

      const pymeTab = screen.getByTestId('tab-pymes-btn');
      const investorTab = screen.getByTestId('tab-inversores-btn');

      expect(pymeTab).toHaveAttribute('aria-selected', 'true');
      expect(investorTab).toHaveAttribute('aria-selected', 'false');

      // Default is PyME panel
      expect(screen.getByTestId('steps-panel-pymes')).toBeInTheDocument();
      expect(screen.queryByTestId('steps-panel-inversores')).not.toBeInTheDocument();

      // Click investor tab
      fireEvent.click(investorTab);

      expect(pymeTab).toHaveAttribute('aria-selected', 'false');
      expect(investorTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('steps-panel-inversores')).toBeInTheDocument();
      expect(screen.queryByTestId('steps-panel-pymes')).not.toBeInTheDocument();
    });

    it('displays the 4 PyME steps: Solicitud online, Evaluación 24h, Publicación en subasta, Desembolso', () => {
      render(<HowItWorks initialAudience="pymes" />);

      expect(screen.getByText('Solicitud online')).toBeInTheDocument();
      expect(screen.getByText('Evaluación 24h')).toBeInTheDocument();
      expect(screen.getByText('Publicación en subasta')).toBeInTheDocument();
      expect(screen.getByText('Desembolso directo')).toBeInTheDocument();

      expect(
        screen.getByText('Completá los datos de tu empresa y el destino de los fondos en pocos minutos.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Validamos tu situación fiscal y crediticia con la Central de Deudores del BCRA sin demoras.')
      ).toBeInTheDocument();
    });

    it('displays the 4 Investor steps: Creá tu cuenta, Elegí oportunidades, Invertí en cuotas, Cobrá mes a mes', () => {
      render(<HowItWorks initialAudience="inversores" />);

      expect(screen.getByText('Creá tu cuenta')).toBeInTheDocument();
      expect(screen.getByText('Elegí oportunidades')).toBeInTheDocument();
      expect(screen.getByText('Invertí en cuotas')).toBeInTheDocument();
      expect(screen.getByText('Cobrá mes a mes')).toBeInTheDocument();

      expect(
        screen.getByText('Registro ágil con verificación de identidad (KYC) y vinculación de cuenta bancaria.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Recibí las cuotas de amortización e interés directo en tu cuenta según el cronograma fijado.')
      ).toBeInTheDocument();
    });
  });

  describe('FinancingCategories Component', () => {
    it('renders cards for all 5 core categories with correct names and descriptions', () => {
      render(<FinancingCategories />);

      expect(screen.getByText('Capital de trabajo')).toBeInTheDocument();
      expect(screen.getByText('Maquinaria y equipamiento')).toBeInTheDocument();
      expect(screen.getByText('Refinanciación de pasivos')).toBeInTheDocument();
      expect(screen.getByText('Expansión comercial')).toBeInTheDocument();
      expect(screen.getByText('Emprender / nuevas PyMEs')).toBeInTheDocument();
    });

    it('links each category card to /solicitar?category=...', () => {
      render(<FinancingCategories />);

      const workingCapitalCard = screen.getByTestId('category-card-working_capital');
      expect(workingCapitalCard).toHaveAttribute('href', '/solicitar?category=working_capital');

      const machineryCard = screen.getByTestId('category-card-machinery');
      expect(machineryCard).toHaveAttribute('href', '/solicitar?category=machinery');

      const refinancingCard = screen.getByTestId('category-card-refinancing');
      expect(refinancingCard).toHaveAttribute('href', '/solicitar?category=refinancing');

      const expansionCard = screen.getByTestId('category-card-expansion');
      expect(expansionCard).toHaveAttribute('href', '/solicitar?category=expansion');

      const newSmeCard = screen.getByTestId('category-card-new_sme');
      expect(newSmeCard).toHaveAttribute('href', '/solicitar?category=new_sme');
    });
  });

  describe('Full Landing Page Integration', () => {
    it('assembles header, hero simulator, trust bar, how it works, categories, and footer', () => {
      render(<Home />);

      expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
      expect(screen.getByTestId('hero-simulator')).toBeInTheDocument(); // Hero simulator
      expect(screen.getByLabelText('Métricas de confianza')).toBeInTheDocument(); // Trust bar
      expect(screen.getByLabelText('Cómo funciona Lencord')).toBeInTheDocument(); // How it works
      expect(screen.getByLabelText('Financiá tu empresa')).toBeInTheDocument(); // Financing categories
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // Footer
    });
  });
});
