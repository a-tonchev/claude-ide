import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import './App.css';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Provider } from 'jotai';

import LoadingContainer from '@/components/containers/LoadingContainer';
import MainRoutes from '@/components/routes/MainRoutes';
import DesignProvider from '@/components/layout/DesignProvider';
import NavigateSetter from '@/components/connections/NavigateSetter';
import GlobalStore from '@/components/state/GlobalStore';
import LabAuthGate from '@/components/LabAuth/LabAuthGate';
import appBranding from '@/helpers/appBranding';

const App = () => {
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <NavigateSetter />
      <Provider store={GlobalStore}>
        <HelmetProvider>
          <Helmet>
            <title>{appBranding.name}</title>
            <link rel="icon" type="image/svg+xml" href={appBranding.icon} />
            <meta name="theme-color" content={appBranding.color} />
            <meta name="description" content={t('app.description')} />
          </Helmet>
          <Suspense fallback={<div />}>
            <LoadingContainer>
              <DesignProvider>
                <LabAuthGate><MainRoutes /></LabAuthGate>
              </DesignProvider>
            </LoadingContainer>
          </Suspense>
        </HelmetProvider>
      </Provider>
    </BrowserRouter>
  );
};

export default App;
