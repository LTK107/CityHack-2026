import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Leaflet's stylesheet first, so our own rules can override its defaults.
import 'leaflet/dist/leaflet.css';
import './styles.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
