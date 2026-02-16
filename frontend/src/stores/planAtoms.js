import GlobalStateHelper from '@/components/state/GlobalStateHelper';

export const PlanStores = {
  plansStore: null,
  activePlanIdStore: null,
};

GlobalStateHelper.atom({
  key: 'plansStore',
  default: [],
  store: PlanStores,
});

GlobalStateHelper.atom({
  key: 'activePlanIdStore',
  default: null,
  store: PlanStores,
});

export const setPlans = plans => {
  PlanStores.plansStore.set(plans || []);
};

export const addPlan = plan => {
  const current = PlanStores.plansStore.get();
  PlanStores.plansStore.set([plan, ...current]);
};

export const updatePlanInStore = (planId, updates) => {
  const current = PlanStores.plansStore.get();
  PlanStores.plansStore.set(
    current.map(p => (p._id === planId ? { ...p, ...updates } : p)),
  );
};

export const removePlanFromStore = planId => {
  const current = PlanStores.plansStore.get();
  PlanStores.plansStore.set(current.filter(p => p._id !== planId));

  if (PlanStores.activePlanIdStore.get() === planId) {
    PlanStores.activePlanIdStore.set(null);
  }
};

export const setActivePlanId = id => {
  PlanStores.activePlanIdStore.set(id);
};

export default {};
