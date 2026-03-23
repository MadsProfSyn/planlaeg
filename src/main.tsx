import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadDurationCache } from "./lib/inspection-duration";

// Pre-load inspection duration matrix from DB
preloadDurationCache();

createRoot(document.getElementById("root")!).render(<App />);
