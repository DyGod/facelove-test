#!/usr/bin/env node
// Creates the "Mystery Gift" and "Dream Skin Primer" products via the Shopify Admin GraphQL API.
// Idempotent: products whose handle already exists are skipped (their IDs are still reported).
//
// Modes:
//   node create-products.mjs            plan: read-only lookups, prints the exact mutations it would run
//   node create-products.mjs --apply    performs the mutations
//   node create-products.mjs --dry-run  fully offline: prints all operations, no network at all
//
// Options:
//   --env-file=<path>  load env from this file instead of <repo root>/.env
//   --no-env-file      do not load any .env file (use the process environment only)
//
// Env (see .env.example at the repo root):
//   SHOPIFY_STORE, SHOPIFY_API_VERSION, and either SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
//   (client credentials grant) or SHOPIFY_ADMIN_TOKEN.
//
// Node 24+, zero dependencies (native fetch).

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ONLINE_STORE_PUBLICATION_NAME = 'Online Store';
const MAX_THROTTLE_RETRIES = 5;

/** Scopes the app needs. write_* implies read_*. */
const REQUIRED_SCOPES = ['write_products', 'write_publications'];

/** Scope to suggest when a given operation is denied. */
const OPERATION_SCOPES = {
  lookup: 'read_products',
  productCreate: 'write_products',
  productVariantsBulkUpdate: 'write_products',
  publications: 'read_publications (or write_publications)',
  publishablePublish: 'write_publications',
  scopes: '(none: currentAppInstallation is always readable)',
};

const PRIMER_IMAGE_BASE = 'https://cdn.shopify.com/s/files/1/1020/8752/4694/files/';

/**
 * Product definitions. `variant` values are applied to the default variant after creation.
 */
const PRODUCTS = [
  {
    handle: 'mystery-gift',
    title: 'Mystery Gift',
    descriptionHtml: '<p>A surprise Facelove treat, included free with qualifying orders.</p>',
    vendor: 'Facelove Cosmetics',
    productType: 'Gift',
    tags: ['free-gift', 'hidden'],
    status: 'ACTIVE',
    images: [
      {
        src: 'https://facelove-cosmetics.com/cdn/shop/files/GiftBoxWhite_a2ebd6c6-6ba2-40c6-a5bd-a06ea2d8eea0.png',
        alt: 'Mystery Gift',
      },
    ],
    variant: {
      price: '10.00',
      compareAtPrice: null,
      sku: 'FL-MYSTERY-GIFT',
      taxable: true,
      requiresShipping: true,
      tracked: false, // never sells out
      inventoryPolicy: 'CONTINUE',
    },
  },
  {
    handle: 'dream-skin-primer',
    title: 'Dream Skin Primer',
    descriptionHtml: '',
    vendor: 'Facelove Cosmetics',
    productType: '',
    tags: [],
    status: 'ACTIVE',
    images: [
      'Dream_Skin_Primer_Product_Image.png',
      'Dream_Skin_Primer_Model_Swatch1.png',
      'Dream_Skin_Primer_Model_BeforeAfter1.png',
      'Dream_Skin_Primer_Model_Swatch2.png',
      'Dream_Skin_Primer_Model_BeforeAfter2.png',
      'Dream_Skin_Primer_Model_BeforeAfter3.png',
      'Dream_Skin_Primer_IngredientsList.png',
      'Dream_Skin_Primer_BenefitsList.png',
    ].map((file) => ({ src: PRIMER_IMAGE_BASE + file, alt: 'Dream Skin Primer' })),
    variant: {
      price: '30.00',
      compareAtPrice: null,
      sku: 'DPCD2-XD590001',
      taxable: true,
      requiresShipping: true,
      tracked: true,
      inventoryPolicy: 'DENY',
    },
  },
];

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

const ACCESS_SCOPES_QUERY = /* GraphQL */ `
  query AccessScopes {
    currentAppInstallation {
      accessScopes { handle }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = /* GraphQL */ `
  query ProductByHandle($query: String!) {
    products(first: 5, query: $query) {
      nodes {
        id
        legacyResourceId
        handle
        variants(first: 1) {
          nodes { id legacyResourceId }
        }
      }
    }
  }
`;

const PRODUCT_CREATE_MUTATION = /* GraphQL */ `
  mutation ProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        legacyResourceId
        handle
        variants(first: 1) {
          nodes { id legacyResourceId }
        }
      }
      userErrors { field message }
    }
  }
`;

const VARIANTS_BULK_UPDATE_MUTATION = /* GraphQL */ `
  mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id legacyResourceId price compareAtPrice sku }
      userErrors { field message }
    }
  }
`;

const PUBLICATIONS_QUERY = /* GraphQL */ `
  query Publications($after: String) {
    publications(first: 50, after: $after) {
      nodes { id name }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const PUBLISHABLE_PUBLISH_MUTATION = /* GraphQL */ `
  mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

// ---------------------------------------------------------------------------
// Args and env
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');
const NO_ENV_FILE = args.includes('--no-env-file');
const ENV_FILE_ARG = args.find((a) => a.startsWith('--env-file='))?.slice('--env-file='.length);

const KNOWN_ARGS = ['--dry-run', '--apply', '--no-env-file'];
const unknown = args.filter((a) => !KNOWN_ARGS.includes(a) && !a.startsWith('--env-file='));
if (unknown.length) fail(`unknown argument(s): ${unknown.join(' ')}`);
if (DRY_RUN && APPLY) fail('--dry-run and --apply cannot be combined.');

class ShopifyError extends Error {}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

/**
 * Loads KEY=VALUE pairs into process.env without overriding variables already set.
 * Values are never logged.
 */
function loadDotEnv() {
  if (NO_ENV_FILE) return;
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const file = ENV_FILE_ARG ? resolve(ENV_FILE_ARG) : resolve(repoRoot, '.env');
  if (!existsSync(file)) {
    if (ENV_FILE_ARG) fail(`env file not found: ${file}`);
    return;
  }
  try {
    process.loadEnvFile(file); // does not override existing process.env values
  } catch (err) {
    fail(`could not parse env file ${file}: ${err.message}`);
  }
  console.log(`Loaded env file: ${file}`);
}

loadDotEnv();

const env = (name) => (process.env[name] ?? '').trim();
const STORE = env('SHOPIFY_STORE').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const API_VERSION = env('SHOPIFY_API_VERSION');
const CLIENT_ID = env('SHOPIFY_CLIENT_ID');
const CLIENT_SECRET = env('SHOPIFY_CLIENT_SECRET');
const ADMIN_TOKEN = env('SHOPIFY_ADMIN_TOKEN');
const USE_CLIENT_CREDENTIALS = Boolean(CLIENT_ID && CLIENT_SECRET);

{
  const missing = [];
  if (!STORE) missing.push('SHOPIFY_STORE (e.g. my-store.myshopify.com)');
  if (!API_VERSION) missing.push('SHOPIFY_API_VERSION (e.g. 2026-10)');
  if (!USE_CLIENT_CREDENTIALS && !ADMIN_TOKEN) {
    if (CLIENT_ID || CLIENT_SECRET) {
      missing.push(`${CLIENT_ID ? 'SHOPIFY_CLIENT_SECRET' : 'SHOPIFY_CLIENT_ID'} (client credentials need both)`);
    } else {
      missing.push('SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET, or SHOPIFY_ADMIN_TOKEN');
    }
  }
  if (missing.length) {
    console.error('Error: missing required environment variable(s):');
    for (const m of missing) console.error(`  - ${m}`);
    console.error('\nSet them in the repo-root .env (copy .env.example) or in your shell.');
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}$/.test(API_VERSION) && API_VERSION !== 'unstable') {
    fail(`SHOPIFY_API_VERSION must look like YYYY-MM (got "${API_VERSION}").`);
  }
}

const GRAPHQL_ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;
const TOKEN_ENDPOINT = `https://${STORE}/admin/oauth/access_token`;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

let accessToken = USE_CLIENT_CREDENTIALS ? null : ADMIN_TOKEN;

async function requestClientCredentialsToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  let response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
  } catch (err) {
    throw new ShopifyError(`token request: network error contacting ${STORE}: ${err.message}`);
  }
  const text = await response.text();
  if (!response.ok) {
    // Body may echo request details; show only a short, non-secret excerpt.
    throw new ShopifyError(
      `token request failed: HTTP ${response.status}. Check SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET ` +
        `and that the app is installed on ${STORE}.\n${redact(text).slice(0, 300)}`,
    );
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ShopifyError('token request: response was not JSON.');
  }
  if (!json.access_token) throw new ShopifyError('token request: response had no access_token.');
  accessToken = json.access_token;
  console.log('Obtained access token via client credentials (not shown).');
}

async function ensureToken() {
  if (!accessToken) await requestClientCredentialsToken();
}

function redact(text) {
  let out = String(text);
  for (const secret of [CLIENT_SECRET, ADMIN_TOKEN, accessToken]) {
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out;
}

// ---------------------------------------------------------------------------
// GraphQL client
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Numeric ID from a GID like gid://shopify/ProductVariant/123 */
const legacyId = (gid) => (gid ? gid.split('/').pop() : null);

/**
 * @param {keyof OPERATION_SCOPES} op
 * @param {string} label
 */
async function gql(op, label, query, variables = {}) {
  if (DRY_RUN) throw new Error('gql() must not be called in dry-run mode');
  await ensureToken();

  let refreshed = false;
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (err) {
      throw new ShopifyError(`${label}: network error contacting ${STORE}: ${err.message}`);
    }

    // Expired client-credentials token: refresh once and retry.
    if (response.status === 401 && USE_CLIENT_CREDENTIALS && !refreshed) {
      console.log(`    ${label}: got 401, requesting a fresh token and retrying once.`);
      refreshed = true;
      await requestClientCredentialsToken();
      continue;
    }

    if (response.status === 429 && attempt < MAX_THROTTLE_RETRIES) {
      const waitMs = Math.max(1000, Number(response.headers.get('Retry-After') ?? 2) * 1000);
      console.log(`    ${label}: HTTP 429, waiting ${Math.round(waitMs / 1000)}s.`);
      await sleep(waitMs);
      continue;
    }

    const text = await response.text();
    if (!response.ok) {
      const hint =
        response.status === 401
          ? USE_CLIENT_CREDENTIALS
            ? ' (token rejected even after refresh)'
            : ' (check SHOPIFY_ADMIN_TOKEN)'
          : response.status === 403
            ? ` (missing access scope; add ${OPERATION_SCOPES[op]} to the app and reinstall/release it)`
            : response.status === 404
              ? ` (check SHOPIFY_STORE and SHOPIFY_API_VERSION=${API_VERSION})`
              : '';
      throw new ShopifyError(`${label}: HTTP ${response.status}${hint}\n${redact(text).slice(0, 500)}`);
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ShopifyError(`${label}: response was not JSON:\n${redact(text).slice(0, 500)}`);
    }

    const errors = json.errors ?? [];
    if (errors.some((e) => e.extensions?.code === 'THROTTLED') && attempt < MAX_THROTTLE_RETRIES) {
      const waitMs = throttleWaitMs(json.extensions?.cost);
      console.log(`    ${label}: THROTTLED, waiting ${(waitMs / 1000).toFixed(1)}s.`);
      await sleep(waitMs);
      continue;
    }

    if (errors.length) {
      const denied = errors.some(
        (e) => e.extensions?.code === 'ACCESS_DENIED' || /access denied|required access/i.test(e.message ?? ''),
      );
      const msgs = errors.map((e) => `  - ${e.message}`).join('\n');
      const hint = denied ? `\nMissing access scope: add ${OPERATION_SCOPES[op]} to the app, then reinstall/release it.` : '';
      throw new ShopifyError(`${label}: GraphQL errors:\n${msgs}${hint}`);
    }

    logCost(json.extensions?.cost);
    return json.data;
  }
}

/** Wait long enough for the bucket to refill to the requested cost. */
function throttleWaitMs(cost) {
  const status = cost?.throttleStatus;
  const requested = cost?.requestedQueryCost ?? 0;
  if (!status?.restoreRate) return 2000;
  const deficit = Math.max(0, requested - status.currentlyAvailable);
  return Math.max(1000, Math.ceil((deficit / status.restoreRate) * 1000) + 250);
}

/** Proactively slow down when the bucket is nearly empty. */
function logCost(cost) {
  const s = cost?.throttleStatus;
  if (s && s.currentlyAvailable < s.maximumAvailable * 0.1) {
    console.log(`    (API budget low: ${s.currentlyAvailable}/${s.maximumAvailable})`);
  }
}

function assertNoUserErrors(label, payload) {
  const errors = payload?.userErrors ?? [];
  if (errors.length) {
    const msgs = errors
      .map((e) => `  - ${e.field ? `${[].concat(e.field).join('.')}: ` : ''}${e.message}`)
      .join('\n');
    throw new ShopifyError(`${label} failed:\n${msgs}`);
  }
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function productInput(p) {
  return {
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.descriptionHtml,
    vendor: p.vendor,
    productType: p.productType,
    tags: p.tags,
    status: p.status,
  };
}

function mediaInput(p) {
  return p.images.map((img) => ({
    originalSource: img.src,
    alt: img.alt,
    mediaContentType: 'IMAGE',
  }));
}

function variantInput(variantId, v) {
  return {
    id: variantId,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    taxable: v.taxable,
    inventoryPolicy: v.inventoryPolicy,
    inventoryItem: {
      sku: v.sku,
      tracked: v.tracked,
      requiresShipping: v.requiresShipping,
    },
  };
}

const PLACEHOLDER_PRODUCT = 'gid://shopify/Product/<new-product-id>';
const PLACEHOLDER_VARIANT = 'gid://shopify/ProductVariant/<default-variant-id>';

function printOperation(label, query, variables) {
  console.log(`\n--- ${label} ---`);
  console.log(query.trim().replace(/^ {2}/gm, ''));
  console.log('variables:', JSON.stringify(variables, null, 2));
}

function printWritePlan(p, publicationId) {
  printOperation('productCreate', PRODUCT_CREATE_MUTATION, {
    product: productInput(p),
    media: mediaInput(p),
  });
  printOperation('productVariantsBulkUpdate', VARIANTS_BULK_UPDATE_MUTATION, {
    productId: PLACEHOLDER_PRODUCT,
    variants: [variantInput(PLACEHOLDER_VARIANT, p.variant)],
  });
  printOperation('publishablePublish', PUBLISHABLE_PUBLISH_MUTATION, {
    id: PLACEHOLDER_PRODUCT,
    input: [{ publicationId }],
  });
}

// ---------------------------------------------------------------------------
// Read-only steps
// ---------------------------------------------------------------------------

async function checkScopes() {
  const data = await gql('scopes', 'Query access scopes', ACCESS_SCOPES_QUERY);
  const granted = new Set(data.currentAppInstallation.accessScopes.map((s) => s.handle));
  const missing = REQUIRED_SCOPES.filter((s) => !granted.has(s));
  if (missing.length) {
    throw new ShopifyError(
      `The app is missing required access scope(s): ${missing.join(', ')}.\n` +
        'Add them in the app configuration, then reinstall/release the app and re-run.',
    );
  }
  console.log(`Scopes OK (${REQUIRED_SCOPES.join(', ')}).`);
}

async function findByHandle(handle) {
  const data = await gql('lookup', `Lookup "${handle}"`, PRODUCT_BY_HANDLE_QUERY, { query: `handle:${handle}` });
  // Search can match loosely; require an exact handle match.
  return data.products.nodes.find((n) => n.handle === handle) ?? null;
}

async function getOnlineStorePublicationId() {
  const names = [];
  let after = null;
  do {
    const data = await gql('publications', 'Query publications', PUBLICATIONS_QUERY, { after });
    const { nodes, pageInfo } = data.publications;
    const pub = nodes.find((n) => n.name === ONLINE_STORE_PUBLICATION_NAME);
    if (pub) return pub.id;
    names.push(...nodes.map((n) => n.name));
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after);
  throw new ShopifyError(
    `Could not find a publication named "${ONLINE_STORE_PUBLICATION_NAME}". Available: ${names.join(', ') || '(none)'}. ` +
      'Ensure the Online Store sales channel is installed.',
  );
}

// ---------------------------------------------------------------------------
// Write steps (only with --apply)
// ---------------------------------------------------------------------------

async function createProduct(p, publicationId) {
  console.log(`\n==> Creating ${p.title} (${p.handle})`);

  const created = await gql('productCreate', `productCreate "${p.handle}"`, PRODUCT_CREATE_MUTATION, {
    product: productInput(p),
    media: mediaInput(p),
  });
  assertNoUserErrors(`productCreate "${p.handle}"`, created.productCreate);
  const product = created.productCreate.product;
  const variant = product.variants.nodes[0];
  if (!variant) throw new ShopifyError(`productCreate "${p.handle}": no default variant returned`);
  console.log(`    created product ${product.id}`);

  const updated = await gql(
    'productVariantsBulkUpdate',
    `productVariantsBulkUpdate "${p.handle}"`,
    VARIANTS_BULK_UPDATE_MUTATION,
    { productId: product.id, variants: [variantInput(variant.id, p.variant)] },
  );
  assertNoUserErrors(`productVariantsBulkUpdate "${p.handle}"`, updated.productVariantsBulkUpdate);
  console.log(`    updated variant ${variant.id} (price ${p.variant.price}, sku ${p.variant.sku ?? '-'})`);

  const published = await gql('publishablePublish', `publishablePublish "${p.handle}"`, PUBLISHABLE_PUBLISH_MUTATION, {
    id: product.id,
    input: [{ publicationId }],
  });
  assertNoUserErrors(`publishablePublish "${p.handle}"`, published.publishablePublish);
  console.log(`    published to ${ONLINE_STORE_PUBLICATION_NAME}`);

  return summary(p.handle, product, variant, 'created');
}

function summary(handle, product, variant, status) {
  return {
    handle,
    status,
    productId: product?.id ?? null,
    productLegacyId: product ? (product.legacyResourceId ?? legacyId(product.id)) : null,
    variantId: variant?.id ?? null,
    variantLegacyId: variant ? (variant.legacyResourceId ?? legacyId(variant.id)) : null,
  };
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function dryRun() {
  console.log('[dry-run] Offline: no network requests will be made.');
  console.log(`[dry-run] GraphQL endpoint would be: ${GRAPHQL_ENDPOINT}`);
  console.log(
    `[dry-run] Auth: ${USE_CLIENT_CREDENTIALS ? `client credentials via ${TOKEN_ENDPOINT}` : 'SHOPIFY_ADMIN_TOKEN'} (values not shown)`,
  );

  console.log('\n=== Read-only steps (plan and --apply) ===');
  printOperation('Query access scopes', ACCESS_SCOPES_QUERY, {});
  printOperation('Query publications (paginated)', PUBLICATIONS_QUERY, { after: null });
  for (const p of PRODUCTS) {
    printOperation(`Lookup "${p.handle}"`, PRODUCT_BY_HANDLE_QUERY, { query: `handle:${p.handle}` });
  }

  for (const p of PRODUCTS) {
    console.log(`\n=== Writes for ${p.title} (${p.handle}), only if missing and only with --apply ===`);
    printWritePlan(p, 'gid://shopify/Publication/<online-store-id>');
  }
  console.log('\n[dry-run] Done. Run without flags to see the live plan, then with --apply to write.');
}

async function run() {
  console.log(`Store: ${STORE}  API: ${API_VERSION}  Mode: ${APPLY ? 'APPLY' : 'plan (no writes)'}`);

  await checkScopes();

  const existing = [];
  const toCreate = [];
  for (const p of PRODUCTS) {
    const found = await findByHandle(p.handle);
    if (found) {
      const variant = found.variants.nodes[0];
      console.log(`  ${p.handle}: exists (product ${found.id}, variant ${variant?.id ?? 'none'}), will skip`);
      existing.push(summary(p.handle, found, variant, 'existing'));
    } else {
      console.log(`  ${p.handle}: not found, will create`);
      toCreate.push(p);
    }
  }

  const publicationId = toCreate.length ? await getOnlineStorePublicationId() : null;

  if (!APPLY) {
    if (toCreate.length) {
      console.log(`\nPlan: ${toCreate.length} product(s) to create. Exact mutations:`);
      for (const p of toCreate) {
        console.log(`\n=== ${p.title} (${p.handle}) ===`);
        printWritePlan(p, publicationId);
      }
      console.log('\nNo changes made. Review the plan above, then re-run with --apply to perform it.');
    } else {
      console.log('\nNothing to create.');
    }
    const planned = toCreate.map((p) => summary(p.handle, null, null, 'would-create'));
    console.log('\nSummary:');
    console.log(JSON.stringify([...existing, ...planned], null, 2));
    return;
  }

  const results = [...existing];
  for (const p of toCreate) results.push(await createProduct(p, publicationId));

  console.log('\nSummary (use variantLegacyId in theme settings / cart add):');
  console.log(JSON.stringify(results, null, 2));
}

async function main() {
  if (DRY_RUN) return dryRun();
  return run();
}

main().catch((err) => {
  if (err instanceof ShopifyError) {
    console.error(`\nError: ${err.message}`);
  } else {
    console.error('\nUnexpected error:', redact(err?.stack ?? err));
  }
  process.exit(1);
});
