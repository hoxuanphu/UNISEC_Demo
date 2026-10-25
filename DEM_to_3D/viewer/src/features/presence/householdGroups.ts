type Anchor = { id: string; x: number; y: number };
export type HouseholdGroup = Anchor & { members: string[] };

/** A symbol is the 22 px disc and the count beside it, reaching about 96 px right of the centre. */
const DISC_PX = 11, COUNT_PX = 96, GAP_PX = 4;
/** Two symbols would meet: discs close together, or one in the other's count. Such a pair is
 * drawn as one total rather than one hiding the other. */
const touching = (a: Anchor, b: Anchor) => Math.hypot(a.x - b.x, a.y - b.y) < 40
  || Math.abs(a.y - b.y) < 2 * DISC_PX + GAP_PX && Math.abs(a.x - b.x) < COUNT_PX + DISC_PX + GAP_PX;

/** Group nearby symbols at a member's actual position. A selected household stays individual. */
export function householdGroups(anchors: readonly Anchor[], selectedId?: string | null): HouseholdGroup[] {
  const groups: HouseholdGroup[] = [];
  for (const anchor of [...anchors].sort((a, b) => a.id.localeCompare(b.id))) {
    const group = anchor.id === selectedId ? undefined : groups.find(item => item.id !== selectedId && touching(anchor, item));
    if (group) group.members.push(anchor.id);
    else groups.push({ ...anchor, members: [anchor.id] });
  }
  return groups;
}
