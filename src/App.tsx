import { Route, Routes } from "react-router-dom";
import { DjStudio } from "./pages/DjStudio";
import { VisualizerPage } from "./pages/VisualizerPage";

export default function App() {
  return (
    <Routes>
      <Route path="/visualizer" element={<VisualizerPage />} />
      <Route path="*" element={<DjStudio />} />
    </Routes>
  );
}
