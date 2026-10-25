import { useMemo } from 'react';
import { useRoutes } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import UrlEnums from '@/components/connections/enums/UrlEnums';

import Authorized from '@/components/routes/Authorized';

import routesBase from './routes';
import Authenticated from './Authenticated';
import Public from './Public';

const normalizeRoutes = routes => routes.map(
  route => {
    const {
      path, type, element, authProps,
    } = route;

    switch (type) {
      case 'public': {
        return {
          path,
          element: <Public element={element} />,
        };
      }
      case 'authenticated': {
        return {
          path,
          element: <Authenticated element={element} />,
        };
      }
      case 'authorized': {
        return {
          path,
          element: <Authorized path={path} element={element} authProps={authProps} />,
        };
      }
      default: {
        return {
          path,
          element,
        };
      }
    }
  },
);

const MainRoutes = () => {
  const normalizedRoutes = useMemo(() => {
    if (import.meta.env.VITE_LAB_AUTH === 'true') {
      return [
        ...routesBase.filter(route => [UrlEnums.DASHBOARD, UrlEnums.INSTANCE_WINDOW, UrlEnums.PLAN_VIEW].includes(route.path)),
        { path: '*', element: <Navigate to={UrlEnums.DASHBOARD} replace /> },
      ];
    }
    return normalizeRoutes(routesBase);
  }, []);

  return useRoutes(normalizedRoutes);
};

export default MainRoutes;
