import type { AuthUserLike } from "../types/auth-user";
import { apiRequest } from "./api-client";

export interface GettingStartedProgress {
  stage: string;
  eligible: boolean;
  active: boolean;
  dismissed: boolean;
  stock: number;
  sales: boolean;
  team: boolean;
  catalog: boolean;
  installed: boolean;
  visible: boolean;
  samples: number;
  storeNamed?: boolean;
  steps?: {
    store: boolean;
    stock: boolean;
    sale: boolean;
    team: boolean;
    install: boolean;
  };
}
export type ProgressPatch = {
  dismissed?: boolean;
  visible?: boolean;
  installed?: true;
  complete?: true;
  completedVia?: "import" | "skip" | "sample";
  installedHow?: "prompt" | "manual";
  stage?: "invite" | "stock";
};
export const getGettingStarted = (user: AuthUserLike) =>
  apiRequest<GettingStartedProgress>(user, "/api/onboarding/progress", {
    fallback: "No se pudieron cargar tus primeros pasos.",
  });
export const updateGettingStarted = (
  user: AuthUserLike,
  patch: ProgressPatch,
) =>
  apiRequest<GettingStartedProgress>(user, "/api/onboarding/progress", {
    method: "PATCH",
    body: patch,
    fallback: "No se pudieron guardar tus primeros pasos.",
  });
export const createSampleStock = (user: AuthUserLike) =>
  apiRequest(user, "/api/onboarding/samples", {
    method: "POST",
    fallback: "No se pudieron cargar los ejemplos.",
  });
export const deleteSampleStock = (user: AuthUserLike) =>
  apiRequest(user, "/api/onboarding/samples", {
    method: "DELETE",
    fallback: "No se pudieron borrar los ejemplos.",
  });
