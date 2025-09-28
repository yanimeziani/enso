# Preact Devtools for ReactLynx

The [Lynx Devtool](https://github.com/lynx-family/lynx-devtool) Panel that allows you to inspect a ReactLynx component hierarchy, including props and state.

## Usage

We need to import `@lynx-js/preact-devtools` somewhere to initialize the connection
to Preact Devtools Panel. Make sure that this import is **the first** import in your
whole app.

```bash
import '@lynx-js/preact-devtools'
```

See the documentation of [Preact Devtools Panel in Lynx Devtool](https://lynxjs.org/guide/devtool/panels/preact-devtools-panel.html#preact-devtools-panel) for more information.

## Contributing

- [`ldt-plugin`](./ldt-plugin/) contains the source code of Preact Devtools Panel in Lynx Devtool. Run it by `npm run dev:ldt-plugin` when developing, and `npm run build:ldt-plugin` to build it.
- [`src`](./src/) contains the source code for ReactLynx App to setup Preact Devtools related hooks. You can build it just by `npm run build:lib` in the root folder of this repository.

The ReactLynx App will communicate with the Preact Devtools Panel in Lynx Devtool using CDP messages.

## Credits

Thanks to:

- [Preact Devtools](https://github.com/preactjs/preact-devtools) for the original Devtools implementation for Preact.
