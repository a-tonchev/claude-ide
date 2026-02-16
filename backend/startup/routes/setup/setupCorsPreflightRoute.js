import setupCors from '../../startupHelpers/setupCors';

const setupCorsPreflightRoute = app => {
  app.options('/*', (res, req) => {
    const origin = req.getHeader('origin');

    res.cork(() => {
      res.writeStatus('204');
      setupCors(res, origin);
      res.end();
    });
  });
};

export default setupCorsPreflightRoute;
