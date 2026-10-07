export type FirebaseAuthContext = {
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
};

export type AppUserContext = {
  userId: string;
  storeId: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  sections?: string[] | null;
};
