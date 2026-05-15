import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGTM, initGA4, initMetaPixel } from "./lib/analytics";

initGTM();
initGA4();
initMetaPixel();

createRoot(document.getElementById("root")!).render(<App />);
// jueves, 14 de mayo de 2026, 22:23:42 CST
