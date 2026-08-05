import '@/lib/sentry';
import '@/lib/stale-bundle';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import PublicPagesAdmin from '@/pages/PublicPagesAdmin';
import RechnungsverwaltungPage from '@/pages/RechnungsverwaltungPage';
import RechnungsverwaltungDetailPage from '@/pages/RechnungsverwaltungDetailPage';
import RechnungspositionenPage from '@/pages/RechnungspositionenPage';
import RechnungspositionenDetailPage from '@/pages/RechnungspositionenDetailPage';
import ProjektverwaltungPage from '@/pages/ProjektverwaltungPage';
import ProjektverwaltungDetailPage from '@/pages/ProjektverwaltungDetailPage';
import LeistungskatalogPage from '@/pages/LeistungskatalogPage';
import LeistungskatalogDetailPage from '@/pages/LeistungskatalogDetailPage';
import KundenverwaltungPage from '@/pages/KundenverwaltungPage';
import KundenverwaltungDetailPage from '@/pages/KundenverwaltungDetailPage';
// <custom:imports>
const NeueRechnungPage = lazy(() => import('@/pages/intents/NeueRechnungPage'));
const RechnungAbschliessenPage = lazy(() => import('@/pages/intents/RechnungAbschliessenPage'));
// </custom:imports>

// Lazy: public pages live outside <Layout> and only load on /#/public/:slug —
// dashboard users never pay for them, anonymous visitors skip the dashboard.
const PublicPage = lazy(() => import('@/pages/public/PublicPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/:slug" element={<Suspense fallback={null}><PublicPage /></Suspense>} />
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="rechnungsverwaltung" element={<RechnungsverwaltungPage />} />
                <Route path="rechnungsverwaltung/:id" element={<RechnungsverwaltungDetailPage />} />
                <Route path="rechnungspositionen" element={<RechnungspositionenPage />} />
                <Route path="rechnungspositionen/:id" element={<RechnungspositionenDetailPage />} />
                <Route path="projektverwaltung" element={<ProjektverwaltungPage />} />
                <Route path="projektverwaltung/:id" element={<ProjektverwaltungDetailPage />} />
                <Route path="leistungskatalog" element={<LeistungskatalogPage />} />
                <Route path="leistungskatalog/:id" element={<LeistungskatalogDetailPage />} />
                <Route path="kundenverwaltung" element={<KundenverwaltungPage />} />
                <Route path="kundenverwaltung/:id" element={<KundenverwaltungDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="verwaltung/oeffentliche-seiten" element={<PublicPagesAdmin />} />
                {/* <custom:routes> */}
                <Route path="intents/neue-rechnung" element={<Suspense fallback={null}><NeueRechnungPage /></Suspense>} />
                <Route path="intents/rechnung-abschliessen" element={<Suspense fallback={null}><RechnungAbschliessenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
