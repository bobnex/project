import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  updateDoc, 
  type Firestore, 
  increment 
} from "firebase/firestore";
import { 
  DEFAULT_ORIGIN_ENTITY, 
  ENTITY_CATALOG, 
  EVOLUTION_STAGES, 
  getNextEvolutionStage, 
  type PlayerEntity, 
  type EntityCustomization 
} from "./entity";

/**
 * Loads all entities owned by the player, ensuring the default Origin entity exists.
 */
export async function loadPlayerEntities(db: Firestore, uid: string): Promise<{
  entities: PlayerEntity[];
  activeEntityId: string;
}> {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    let activeEntityId = userSnap.exists() ? (userSnap.data().activeEntityId as string | undefined) : undefined;

    const entitiesCol = collection(db, "users", uid, "entities");
    const snap = await getDocs(entitiesCol);

    if (snap.empty) {
      // First-time onboarding: create Origin entity
      const originRef = doc(db, "users", uid, "entities", "origin");
      await setDoc(originRef, DEFAULT_ORIGIN_ENTITY);
      await updateDoc(userRef, { activeEntityId: "origin" }).catch(async () => {
        await setDoc(userRef, { activeEntityId: "origin" }, { merge: true });
      });

      return {
        entities: [DEFAULT_ORIGIN_ENTITY],
        activeEntityId: "origin",
      };
    }

    const entities: PlayerEntity[] = [];
    snap.forEach((d) => {
      entities.push({ id: d.id, ...(d.data() as Omit<PlayerEntity, "id">) });
    });

    if (!activeEntityId || !entities.some((e) => e.id === activeEntityId)) {
      activeEntityId = entities[0]?.id || "origin";
      await updateDoc(userRef, { activeEntityId }).catch(() => {});
    }

    return { entities, activeEntityId };
  } catch (err) {
    console.error("Failed to load player entities:", err);
    return { entities: [DEFAULT_ORIGIN_ENTITY], activeEntityId: "origin" };
  }
}

/**
 * Sets the active entity representing the player across Juvora.
 */
export async function setActivePlayerEntity(db: Firestore, uid: string, entityId: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { activeEntityId: entityId, entityUpdatedAt: Date.now() });
}

/**
 * Saves visual customization updates for a specific entity.
 */
export async function saveEntityCustomization(
  db: Firestore,
  uid: string,
  entityId: string,
  customization: EntityCustomization
): Promise<void> {
  const entityRef = doc(db, "users", uid, "entities", entityId);
  await updateDoc(entityRef, { customization });
}

/**
 * Executes the Hybrid Evolution ritual once the player decides to evolve.
 */
export async function evolvePlayerEntity(
  db: Firestore,
  uid: string,
  entity: PlayerEntity
): Promise<{ success: boolean; newStage?: PlayerEntity["stage"]; message: string }> {
  const nextStage = getNextEvolutionStage(entity.stage);
  if (!nextStage) {
    return { success: false, message: "This Entity has already reached the Transcendent zenith." };
  }

  const req = EVOLUTION_STAGES[nextStage];
  if (entity.currentXp < req.minXp) {
    return { success: false, message: `Requires ${req.minXp} Entity XP to evolve (Current: ${entity.currentXp}).` };
  }

  const entityRef = doc(db, "users", uid, "entities", entity.id);
  await updateDoc(entityRef, {
    stage: nextStage,
    lastEvolvedAt: Date.now(),
  });

  return { success: true, newStage: nextStage, message: `Ascension complete! Entity evolved to ${req.name}!` };
}

/**
 * Awards Entity XP directly to the active entity after eligible battles.
 */
export async function awardActiveEntityXp(
  db: Firestore,
  uid: string,
  activeEntityId: string,
  xpGain: number
): Promise<void> {
  if (xpGain <= 0) return;
  try {
    const entityRef = doc(db, "users", uid, "entities", activeEntityId);
    await updateDoc(entityRef, {
      currentXp: increment(xpGain),
    });
  } catch (err) {
    console.error("Failed to award entity XP:", err);
  }
}

/**
 * Purchases a new Entity from the Juvora Coin Store.
 */
export async function purchaseEntityArchetype(
  db: Firestore,
  uid: string,
  archetypeId: string,
  currentCoinBalance: number
): Promise<{ success: boolean; message: string; newEntity?: PlayerEntity }> {
  const archetype = ENTITY_CATALOG.find((a) => a.id === archetypeId);
  if (!archetype) return { success: false, message: "Entity not found in catalog." };

  if (currentCoinBalance < archetype.priceCoins) {
    return { success: false, message: `Insufficient Juvora Coins (${archetype.priceCoins} required).` };
  }

  // Deduct from cosmetic wallet
  const walletRef = doc(db, "cosmetic_wallets", uid);
  await updateDoc(walletRef, {
    balance: increment(-archetype.priceCoins),
    updatedAt: Date.now(),
  });

  // Create new player entity instance
  const newEntity: PlayerEntity = {
    id: archetype.id,
    archetypeId: archetype.id,
    name: archetype.name,
    title: archetype.title,
    rarity: archetype.rarity,
    stage: "awakened",
    currentXp: 0,
    obtainedAt: Date.now(),
    customization: {
      ...DEFAULT_ENTITY_CUSTOMIZATION,
      primaryColor: archetype.defaultPrimary,
      secondaryColor: archetype.defaultSecondary,
      coreShape: archetype.defaultShape,
    },
  };

  const entityRef = doc(db, "users", uid, "entities", archetype.id);
  await setDoc(entityRef, newEntity);

  return { success: true, message: `Successfully forged ${archetype.name}!`, newEntity };
}
