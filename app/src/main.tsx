import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './data/store';
import { RequireProfile } from './app/Shell';
import ErrorBoundary from './app/ErrorBoundary';
import './styles/global.css';

// Chaque espace est chargé seulement quand on l'ouvre (la carte et la 3D ne pèsent que là où elles servent).
const Entry = lazy(() => import('./app/Onboarding'));
const PLayout = lazy(() => import('./spaces/particulier/Layout'));
const PMoments = lazy(() => import('./spaces/particulier/Moments'));
const PPlanning = lazy(() => import('./spaces/particulier/Planning'));
const PAppareils = lazy(() => import('./spaces/particulier/Appareils'));
const PBilan = lazy(() => import('./spaces/particulier/Bilan'));
const Settings = lazy(() => import('./features/Settings'));
const Entreprise = lazy(() => import('./spaces/entreprise/Entreprise'));
const Collectivite = lazy(() => import('./spaces/collectivite/Collectivite'));
const Simulateur = lazy(() => import('./spaces/ville/Ville'));

const Loading = () => <div className="space" style={{ display: 'grid', placeItems: 'center' }} role="status">Chargement…</div>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Entry />} />
            <Route path="/particulier" element={<RequireProfile kind="particulier"><PLayout /></RequireProfile>}>
              <Route index element={<Navigate to="moments" replace />} />
              <Route path="moments" element={<PMoments />} />
              <Route path="planning" element={<PPlanning />} />
              <Route path="appareils" element={<PAppareils />} />
              <Route path="bilan" element={<PBilan />} />
              <Route path="reglages" element={<Settings />} />
            </Route>
            <Route path="/entreprise/*" element={<RequireProfile kind="entreprise"><Entreprise /></RequireProfile>} />
            <Route path="/collectivite/simulateur" element={<RequireProfile kind="collectivite"><Simulateur /></RequireProfile>} />
            <Route path="/collectivite/*" element={<RequireProfile kind="collectivite"><Collectivite /></RequireProfile>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </StoreProvider>
  </StrictMode>,
);
