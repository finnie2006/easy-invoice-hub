import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./lib/register-service-worker";

registerServiceWorker();

// After a new deploy, an open tab may request page chunks that no longer exist.
// Reload once to pick up the new build instead of showing a broken page.
window.addEventListener("vite:preloadError", (event) => {
  const reloadKey = "chunk-reload-at";
  const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastReload > 10_000) {
    event.preventDefault();
    sessionStorage.setItem(reloadKey, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
