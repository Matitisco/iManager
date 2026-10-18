export const FIRST_STEP_IDS = ["store", "stock", "sale", "team", "install"] as const;
export type FirstStepId = (typeof FIRST_STEP_IDS)[number];

export type FirstStepFlags = Record<FirstStepId, boolean>;

export function storeStepDone(name: string | null | undefined) {
  return Boolean(name?.trim());
}

/** Count only real inventory rows; sample devices do not advance onboarding. */
export function stockStepDone(items: number) {
  return items >= 1;
}

export function saleStepDone(sales: number) {
  return sales >= 1;
}

/** An invitation already sent, or anyone besides the owner. */
export function teamStepDone(members: number, invitations: number) {
  return members > 1 || invitations > 0;
}

export function evaluateFirstSteps(input: {
  storeName: string | null | undefined;
  inventoryItems: number;
  sales: number;
  members: number;
  invitations: number;
  installed: boolean;
}): FirstStepFlags {
  return {
    store: storeStepDone(input.storeName),
    stock: stockStepDone(input.inventoryItems),
    sale: saleStepDone(input.sales),
    team: teamStepDone(input.members, input.invitations),
    install: input.installed,
  };
}

export function firstStepsVisibleTo(role: string | null | undefined) {
  return role === "OWNER" || role === "MANAGER";
}
