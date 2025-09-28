import { render, screen } from '@testing-library/react';
import React from 'react';
import { ThoughtzMobileApp } from '../App';

describe('ThoughtzMobileApp', () => {
  it('renders seeded thoughts and detail panel', () => {
    render(<ThoughtzMobileApp />);

    expect(screen.getByText(/Thoughtz Lynx Playground/)).toBeInTheDocument();
    expect(screen.getByText(/Tap to capture/)).toBeInTheDocument();
    expect(screen.queryByText(/Select a thought/)).not.toBeInTheDocument();
  });
});
