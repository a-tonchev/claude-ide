import { useCallback } from 'react';

import Connections, { ApiEndpoints } from '@/components/connections/Connections';
import { useStoreValue } from '@/components/state/GlobalState';
import {
  PlanStores,
  setPlans,
  addPlan,
  updatePlanInStore,
  removePlanFromStore,
  setActivePlanId,
} from '@/stores/planAtoms';

const usePlans = () => {
  const plans = useStoreValue(PlanStores.plansStore);
  const activePlanId = useStoreValue(PlanStores.activePlanIdStore);

  const fetchPlans = useCallback(async (projectId) => {
    const params = projectId ? { projectId } : {};
    const result = await Connections.postRequest(ApiEndpoints.plansAll, params);
    if (result?.ok) {
      setPlans(result.data.plans);
    }
    return result;
  }, []);

  const fetchPlan = useCallback(async (planId) => {
    const result = await Connections.postRequest(ApiEndpoints.plansGet, { _id: planId });
    return result?.ok ? result.data.plan : null;
  }, []);

  const createPlan = useCallback(async (planData) => {
    const result = await Connections.postRequest(ApiEndpoints.plansAdd, planData);
    if (result?.ok) {
      addPlan({ ...planData, _id: result.data._id });
    }
    return result;
  }, []);

  const updatePlan = useCallback(async (planId, updates) => {
    const result = await Connections.postRequest(ApiEndpoints.plansUpdate, {
      _id: planId,
      ...updates,
    });
    if (result?.ok) {
      updatePlanInStore(planId, updates);
    }
    return result;
  }, []);

  const deletePlan = useCallback(async (planId) => {
    const result = await Connections.postRequest(ApiEndpoints.plansDelete, { _id: planId });
    if (result?.ok) {
      removePlanFromStore(planId);
    }
    return result;
  }, []);

  return {
    plans,
    activePlanId,
    setActivePlanId,
    fetchPlans,
    fetchPlan,
    createPlan,
    updatePlan,
    deletePlan,
  };
};

export default usePlans;
