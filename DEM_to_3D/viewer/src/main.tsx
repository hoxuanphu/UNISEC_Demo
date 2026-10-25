import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { keepZoomOnMap } from './shared/gestures/mapZoomGesture';

keepZoomOnMap();

// TerrainViewer owns GPU resources and disposes them when its asset changes;
// avoid React's development-only double effect pass around that ownership.
createRoot(document.getElementById('root')!).render(<App />);
