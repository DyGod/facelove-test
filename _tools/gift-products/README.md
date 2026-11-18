# Gift products setup

Creates two products the theme depends on:

| Handle              | Title             | Price | Notes                                   |
| ------------------- | ----------------- | ----- | --------------------------------------- |
| `mystery-gift`      | Mystery Gift      | 10.00 | Inventory not tracked (never sells out) |
| `dream-skin-primer` | Dream Skin Primer | 30.00 | SKU `DPCD2-XD590001`, inventory tracked |

This folder is outside the theme directories, so `shopify theme push` ignores it.

## 1. Credentials

The script follows the repo's Admin API conventions (AGENTS.md, "Admin API access"). It reads
the gitignored repo-root `.env` (copy `.env.example`). Variables already set in your shell win.
Values are never printed.

```sh
SHOPIFY_STORE=my-store.myshopify.com
SHOPIFY_API_VERSION=2026-10
# Either a Dev Dashboard app (client credentials grant):
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
# Or an older admin-created custom app:
# SHOPIFY_ADMIN_TOKEN=shpat_...
```

With a client ID and secret, the script requests a token from
`https://$SHOPIFY_STORE/admin/oauth/access_token`. If the token expires mid-run (401), it
requests a new one once and retries.

**Required access scopes:** `write_products` and `write_publications`. Each write scope
includes its read scope. Before planning, the script checks the app's granted scopes. If any
are missing, it names them and stops. Add them to the app, then reinstall or release it.

## 2. Run it (Node 24+, no install needed)

```sh
cd _tools/gift-products
node create-products.mjs --dry-run   # fully offline: prints every query/mutation, no network
node create-products.mjs             # plan: read-only lookups, prints the exact mutations, writes nothing
node create-products.mjs --apply     # performs the planned creates
```

- The default mode is the plan. Run it, review the products and variables it would create,
  and only then run `--apply`.
- The script is idempotent. A product whose handle already exists is skipped, and its IDs are
  still reported.
- `--apply` runs `productCreate` (with images), then `productVariantsBulkUpdate` (price, SKU,
  tracking, shipping), then `publishablePublish` to the Online Store.
- It stops on any `userErrors` or top-level `errors`. If the API is throttled, it waits and
  retries, using `extensions.cost` to work out how long.
- The run ends with a JSON summary. Copy each `variantLegacyId` (the numeric variant ID) into
  the theme where the gift or upsell variant is configured.
- Options:
  - `--env-file=<path>` loads a different env file.
  - `--no-env-file` uses only the shell environment.

After `--apply`, the Dream Skin Primer has 0 stock because its inventory is tracked. Set
quantities in Admin > Products > Dream Skin Primer > Inventory, or it will show as sold out.

## Alternative: CSV import

In Admin, go to **Products > Import** and upload `products.csv`. If you import it, you don't
need the script. Running the script afterwards would only skip the existing handles. After the
import, find each variant ID in the product's variant URL in Admin
(`…/products/<productId>/variants/<variantId>`).

## Making the gift free

The Mystery Gift has a real price (10.00), so it shows a value. The theme only adds it to the
cart. **The $0 price must come from an automatic discount** that the merchant sets up in Admin:

Go to **Discounts > Create discount > Buy X get Y** (automatic). Set the customer to get
`Mystery Gift` at **100% off**, set the qualifying condition you want (for example a minimum
purchase amount or specific products), and limit it to one use per order.
