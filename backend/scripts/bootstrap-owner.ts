import { Prisma } from "@prisma/client";
import { admin } from "../src/plugins/firebase-admin.js";
import { prisma } from "../src/plugins/prisma.js";

type Args = {
  firebaseUid?: string;
  email?: string;
  storeName?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (!current.startsWith("--")) continue;

    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for ${current}`);
    }

    switch (current) {
      case "--firebaseUid":
        args.firebaseUid = next;
        break;
      case "--email":
        args.email = next;
        break;
      case "--storeName":
        args.storeName = next;
        break;
      default:
        throw new Error(`Unknown argument: ${current}`);
    }

    i += 1;
  }

  return args;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function deriveStoreName(displayName: string | null | undefined, email: string | null | undefined) {
  if (displayName) {
    return `${displayName.trim()} Store`;
  }

  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) {
      return `${localPart} Store`;
    }
  }

  return "iManager Store";
}

async function resolveFirebaseUser(args: Args) {
  if (!args.firebaseUid && !args.email) {
    throw new Error("Provide --firebaseUid or --email");
  }

  if (args.firebaseUid) {
    return admin.auth().getUser(args.firebaseUid);
  }

  return admin.auth().getUserByEmail(args.email!);
}

async function resolveOrCreateDbUser(firebaseUser: Awaited<ReturnType<typeof resolveFirebaseUser>>) {
  const existingByUid = await prisma.user.findUnique({
    where: { firebaseUid: firebaseUser.uid },
  });

  if (existingByUid) {
    return existingByUid;
  }

  const email = asString(firebaseUser.email);
  const existingByEmail = email
    ? await prisma.user.findFirst({
        where: { email },
      })
    : null;

  if (existingByEmail) {
    if (existingByEmail.firebaseUid !== firebaseUser.uid) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          firebaseUid: firebaseUser.uid,
          displayName: existingByEmail.displayName ?? asString(firebaseUser.displayName),
          avatarUrl: existingByEmail.avatarUrl ?? asString(firebaseUser.photoURL),
        },
      });
    }

    return existingByEmail;
  }

  return prisma.user.create({
    data: {
      firebaseUid: firebaseUser.uid,
      email,
      displayName: asString(firebaseUser.displayName),
      avatarUrl: asString(firebaseUser.photoURL),
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const firebaseUser = await resolveFirebaseUser(args);
  const dbUser = await resolveOrCreateDbUser(firebaseUser);

  const defaultMembership = await prisma.storeMember.findFirst({
    where: {
      userId: dbUser.id,
      isDefault: true,
    },
    select: {
      id: true,
      store: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (defaultMembership) {
    console.log(
      `Default membership already exists for ${dbUser.email ?? dbUser.firebaseUid}: ${defaultMembership.store.name} (${defaultMembership.store.id})`
    );
    return;
  }

  const storeName = args.storeName ?? deriveStoreName(dbUser.displayName, dbUser.email);

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const store = await tx.store.create({
      data: {
        name: storeName,
      },
    });

    const membership = await tx.storeMember.create({
      data: {
        storeId: store.id,
        userId: dbUser.id,
        role: "OWNER",
        isDefault: true,
      },
    });

    return { store, membership };
  });

  console.log(
    JSON.stringify(
      {
        user: {
          id: dbUser.id,
          firebaseUid: dbUser.firebaseUid,
          email: dbUser.email,
        },
        store: {
          id: created.store.id,
          name: created.store.name,
        },
        membership: {
          id: created.membership.id,
          role: created.membership.role,
          isDefault: created.membership.isDefault,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    console.error("Bootstrap owner failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
