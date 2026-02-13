import createBasicRoutes from '#modules/routing/createRoutes';
import FileBrowser from '#modules/fileBrowser/FileBrowser';

const DefaultRoute = createBasicRoutes({
  routeData: [
    {
      method: 'any',
      path: '/',
      handler: ctx => ctx.body = 'Hello API!',
    },
    {
      method: 'post',
      path: '/browse',
      handler: ctx => {
        const { path } = ctx.request.body;
        const result = FileBrowser.listDirectories(path || '');
        return ctx.modS.responses.createSuccessResponse(ctx, result);
      },
    },
  ],
});

export default DefaultRoute;
