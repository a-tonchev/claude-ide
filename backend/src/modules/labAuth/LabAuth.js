import SystemSettingsServices from '#modules/systemSettings/SystemSettingsServices';
import { getSharedDb } from '#modules/db/mongoPool';
import { LabAuthCore } from './LabAuthCore.js';

const LabAuth = new LabAuthCore(
  SystemSettingsServices.getSettings().labAuth,
  // Lazy access avoids the existing Config -> routes -> InstanceManager import cycle.
  () => getSharedDb(),
  SystemSettingsServices.getRoutePrefix(),
);

export default LabAuth;
