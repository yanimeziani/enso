import { render, screen } from '@testing-library/react';
import React from 'react';
import { EnsoMobileApp } from '../App';

describe('EnsoMobileApp', () => {
  it('renders seeded thoughts and detail panel', () => {
    render(<EnsoMobileApp />);

    expect(screen.getByText(/Enso Lynx Playground/)).toBeInTheDocument();
    expect(screen.getByText(/Tap to capture/)).toBeInTheDocument();
    expect(screen.queryByText(/Select a thought/)).not.toBeInTheDocument();
  });
});
