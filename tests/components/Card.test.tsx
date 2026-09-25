import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';

describe('Card Primitive', () => {
  it('renders card container and subcomponents', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Oportunidad PyME #101</CardTitle>
          <CardDescription>Expansión de capacidad productiva</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Monto: $5.000.000 ARS</p>
        </CardContent>
        <CardFooter>
          <button>Participar</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card-container')).toBeInTheDocument();
    expect(screen.getByTestId('card-header')).toBeInTheDocument();
    expect(screen.getByTestId('card-title')).toHaveTextContent('Oportunidad PyME #101');
    expect(screen.getByTestId('card-description')).toHaveTextContent(
      'Expansión de capacidad productiva'
    );
    expect(screen.getByTestId('card-content')).toHaveTextContent(
      'Monto: $5.000.000 ARS'
    );
    expect(screen.getByTestId('card-footer')).toBeInTheDocument();
  });
});
