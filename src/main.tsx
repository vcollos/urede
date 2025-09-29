
/**
 * Proteção contra registro duplicado de Custom Elements que algumas dependências
 * (ex.: webcomponents polyfills / overlays) podem tentar definir mais de uma vez.
 * Isso previne o erro: "A custom element with name 'mce-autosize-textarea' has already been defined."
 */
(function () {
  try {
    const ce = (window as any).customElements;
    if (!ce || !ce.define) return;
    const _define = ce.define.bind(ce);
    ce.define = function (name: string, ctor: any, options?: any) {
      try {
        if (ce.get(name)) return; // ignore duplicate
        return _define(name, ctor, options);
      } catch (err) {
        console && console.warn && console.warn('CE define suppressed for', name, err);
      }
    };
  } catch (e) {
    // swallow
  }
})();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/material-overrides.css";

createRoot(document.getElementById("root")!).render(<App />);
