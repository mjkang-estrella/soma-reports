/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authenticatedMarketplaceLedger from "../authenticatedMarketplaceLedger.js";
import type * as marketplaceCatalog from "../marketplaceCatalog.js";
import type * as marketplacePositionLedger from "../marketplacePositionLedger.js";
import type * as reportPackages from "../reportPackages.js";
import type * as reports from "../reports.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  authenticatedMarketplaceLedger: typeof authenticatedMarketplaceLedger;
  marketplaceCatalog: typeof marketplaceCatalog;
  marketplacePositionLedger: typeof marketplacePositionLedger;
  reportPackages: typeof reportPackages;
  reports: typeof reports;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
