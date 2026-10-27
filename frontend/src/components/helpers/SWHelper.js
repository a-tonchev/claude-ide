// Updates target this page's registration and reload only after the new worker controls it.
export function createSWHelper(page, browser, timeoutMs = 20000) {
  const { serviceWorker } = browser;
  let pendingUpdate;
  let reloading = false;
  page.swNeedUpdate = false;
  page.swStartingTime = Date.now();
  const reload = () => {
    if (reloading) return;
    reloading = true;
    page.swNeedUpdate = false;
    page.location.reload();
  };

  const helper = {
    async getRegistration() {
      return serviceWorker?.getRegistration(page.location.href);
    },
    async getWaitingWorker() {
      return (await helper.getRegistration())?.waiting;
    },
    async getActiveWorker() {
      return (await helper.getRegistration())?.active;
    },
    async skipWaitingWhenSolo() {
      (await helper.getWaitingWorker())?.postMessage({ type: 'SKIP_WAITING_WHEN_SOLO' });
    },
    async callNewServiceWorkerEvent() {
      page.swNeedUpdate = true;
      // Notify this tab directly too: delivery must not depend on an older worker's protocol.
      page.dispatchEvent(new Event('newVersion'));
      (await helper.getActiveWorker())?.postMessage({ type: 'OPEN_MESSAGE_DIALOG_ALL_CLIENTS' });
    },
    isNewAvailable: () => page.swNeedUpdate,
    updateByUser() {
      if (pendingUpdate) return pendingUpdate;
      pendingUpdate = (async () => {
        const registration = await helper.getRegistration();
        if (!registration) throw new Error('Service worker is unavailable. Please reload and try again.');
        if (!registration.waiting) await registration.update();
        const worker = registration.waiting || registration.installing;
        if (!worker) {
          // Another tab may have activated the update while the prompt was open.
          reload();
          return;
        }
        await new Promise((resolve, reject) => {
          let timer;
          let onState;
          let onController;
          const cleanup = () => {
            clearTimeout(timer);
            worker.removeEventListener('statechange', onState);
            serviceWorker.removeEventListener('controllerchange', onController);
          };
          const finish = () => { cleanup(); reload(); resolve(); };
          onController = () => {
            if (serviceWorker.controller === worker) finish();
          };
          onState = () => {
            if (worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
            if (worker.state === 'redundant') {
              cleanup();
              reject(new Error('The update could not be installed. Please try again.'));
            }
            onController();
          };
          serviceWorker.addEventListener('controllerchange', onController);
          worker.addEventListener('statechange', onState);
          timer = setTimeout(() => {
            cleanup();
            reject(new Error('The update is taking too long. Please try again.'));
          }, timeoutMs);
          // A waiting worker already has a complete revisioned Workbox precache.
          // This also works with the previous worker: no cache-copy message is needed.
          if (registration.waiting === worker) worker.postMessage({ type: 'SKIP_WAITING' });
          onController();
        });
      })().finally(() => { pendingUpdate = null; });
      return pendingUpdate;
    },
  };
  // Keep legacy callers working while cached pages migrate to the new update flow.
  helper.forceRefreshSW = helper.updateByUser;
  helper.skipWaiting = helper.updateByUser;
  return helper;
}

export default createSWHelper(window, navigator);
