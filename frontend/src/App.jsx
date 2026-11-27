import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Architecture from "./pages/Architecture.jsx";
import Chat from "./pages/Chat.jsx";
import FlowPage from "./pages/FlowPage.jsx";
import Analytics from "./pages/Analytics.jsx";
import CodeExplorer from "./pages/CodeExplorer.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="chat" element={<Chat />} />
        <Route path="flow" element={<FlowPage />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="files" element={<CodeExplorer />} />
      </Route>
    </Routes>
  );
}
