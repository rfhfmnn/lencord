import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

function SmokeComponent({ message }: { message: string }) {
  return <div>{message}</div>;
}

describe('Smoke Test Suite', () => {
  it('verifies basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('verifies React Testing Library rendering', () => {
    render(<SmokeComponent message="Lencord Test Environment" />);
    expect(screen.getByText('Lencord Test Environment')).toBeInTheDocument();
  });
});
