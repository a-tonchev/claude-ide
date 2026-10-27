import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

import appBranding from '@/helpers/appBranding';

const Home = () => {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{`${appBranding.name} | Home`}</title>
        <meta name="description" content={`${t('app.description')} | Home`} />
      </Helmet>
      Home
    </>
  );
};

export default Home;
