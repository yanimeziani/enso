import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createLynxApp, LynxText, LynxView } from '..';

const DemoApp: React.FC = () => (
  <LynxView>
    <LynxText>Hello Lynx</LynxText>
  </LynxView>
);

describe('createLynxApp', () => {
  it('invokes the render host with the component', () => {
    const host = { render: vi.fn() };
    const app = createLynxApp({ name: 'Demo', component: DemoApp });

    app.start(host);

    expect(host.render).toHaveBeenCalled();
  });

  it('warns when started without host', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createLynxApp({ name: 'Demo', component: DemoApp });

    app.start();

    expect(warn).toHaveBeenCalledWith('[Lynx] start() called for Demo without a host renderer.');
    warn.mockRestore();
  });
});
