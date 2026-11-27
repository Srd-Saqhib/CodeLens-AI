import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { RepoProvider } from "./hooks/useRepo.jsx";
import { ThemeProvider } from "./hooks/useTheme.jsx";
import "./styles/app.css";
createRoot(document.getElementById("root")).render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ThemeProvider>
      <RepoProvider>
        <App />
      </RepoProvider>
    </ThemeProvider>
  </BrowserRouter>
);
