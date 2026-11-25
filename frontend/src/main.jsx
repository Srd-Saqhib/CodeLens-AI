import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { RepoProvider } from "./hooks/useRepo.jsx";
import "./styles/app.css";
createRoot(document.getElementById("root")).render(<BrowserRouter><RepoProvider><App /></RepoProvider></BrowserRouter>);
