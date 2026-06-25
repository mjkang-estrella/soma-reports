import { v } from "convex/values";

import { query } from "./_generated/server";
import { authenticatedMarketplacePositionLedger } from "./authenticatedMarketplaceLedger";

export const get = query({
  args: {
    kind: v.optional(v.union(v.literal("marketplace"), v.literal("order"), v.literal("unknown"))),
    canonicalSlug: v.optional(v.string()),
    groupLabel: v.optional(v.string()),
    includeDuplicateGroups: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const positions = authenticatedMarketplacePositionLedger.positions.filter((position) => {
      if (args.kind !== undefined && position.kind !== args.kind) {
        return false;
      }
      if (args.canonicalSlug !== undefined && position.canonicalSlug !== args.canonicalSlug) {
        return false;
      }
      if (args.groupLabel !== undefined && position.groupLabel !== args.groupLabel) {
        return false;
      }
      return true;
    });

    const includedPositionNumbers = new Set(positions.map((position) => position.positionNumber));
    const duplicateGroups =
      args.includeDuplicateGroups === false
        ? []
        : authenticatedMarketplacePositionLedger.duplicateGroups
            .map((group) => ({
              ...group,
              positionNumbers: group.positionNumbers.filter((positionNumber) =>
                includedPositionNumbers.has(positionNumber),
              ),
              groupLabels: group.groupLabels.filter((_, index) =>
                includedPositionNumbers.has(group.positionNumbers[index]),
              ),
            }))
            .filter((group) => group.positionNumbers.length > 1);

    return {
      ...authenticatedMarketplacePositionLedger,
      positions,
      duplicateGroups,
    };
  },
});
