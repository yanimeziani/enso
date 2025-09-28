import React from 'react';

export interface LynxAppConfig {
  name: string;
  component: React.ComponentType;
}

export interface LynxRenderHost {
  render(element: React.ReactElement): void;
}

export interface LynxApplication {
  readonly name: string;
  start(host?: LynxRenderHost): void;
}

export const createLynxApp = ({ name, component }: LynxAppConfig): LynxApplication => {
  return {
    name,
    start(host) {
      const element = React.createElement(component);

      if (!host) {
        console.warn(`[Lynx] start() called for ${name} without a host renderer.`);
        return;
      }

      host.render(element);
    }
  };
};
