// The read-only tool implementations, backed entirely by the ai-price-index library.
//
// Every function here is a pure wrapper over the published lib (current / priceOn /
// usdForRollupRaw / resolve / models / meta). There is no pricing logic, no data layer, and no
// network call: the lib bundles the dated dataset inline. Each result carries provenance (source URL,
// last_validated, confidence) plus the dataset attribution so the calling agent can cite it.
import {
  current,
  priceOn,
  resolve,
  models as libModels,
  usdForRollupRaw,
  meta
} from 'ai-price-index';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A compact, citable footer attached to every result. dataModified is the dated release this install
// pins to; source is the canonical data page; license + attribution are the CC BY 4.0 terms to honour.
function provenance() {
  return {
    dataset: 'AI Price Index by RoninForge',
    data_version: meta.dataModified,
    license: meta.license,
    attribution: meta.attribution,
    doi: meta.doi,
    source: meta.source.dataPage,
    repo: meta.source.repo
  };
}

// Flatten a lib IntervalView (input or output side) into the shape we expose. Keeps the per-million
// price plus the proof fields so an agent can quote both the number and where it came from.
function sideView(iv) {
  if (!iv) return null;
  return {
    usd_per_mtok: iv.price_usd,
    unit: iv.unit,
    effective_from: iv.from,
    effective_to: iv.to,
    last_validated: iv.last_validated,
    confidence: iv.confidence,
    source_url: iv.source
  };
}

// Shape a lib priceOn/current result into a clean, self-describing record.
function priceView(result) {
  return {
    query: result.query,
    provider: result.provider,
    model: result.model,
    aliases: result.aliases,
    date: result.date,
    covered: result.covered,
    input: sideView(result.input),
    output: sideView(result.output),
    provenance: provenance()
  };
}

function notFound(query, extra = {}) {
  return {
    error: 'model_not_found',
    query,
    message:
      `No model matched "${query}" in the AI Price Index. Use list_models to see known ids, ` +
      'or pass an explicit provider to disambiguate a bare id.',
    ...extra,
    provenance: provenance()
  };
}

// Run a resolve() that may throw on an ambiguous bare id, and turn the throw into a structured error
// instead of crashing the tool call.
function tryResolve(model, provider) {
  try {
    return { ok: true, value: resolve(model, provider ? { provider } : undefined) };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/** current_price(model, provider?) - today's input/output rate for a model id, with provenance. */
export function currentPrice({ model, provider }) {
  const resolved = tryResolve(model, provider);
  if (!resolved.ok) return { error: 'ambiguous_model', query: model, message: resolved.error, provenance: provenance() };
  if (!resolved.value) return notFound(model);
  const result = current(model, provider ? { provider } : undefined);
  if (!result) return notFound(model);
  return priceView(result);
}

/** price_on(model, date, provider?) - the rate IN EFFECT on a YYYY-MM-DD date. The point-in-time tool. */
export function priceOnDate({ model, date, provider }) {
  if (!ISO_DATE.test(date)) {
    return { error: 'bad_date', query: model, message: `date must be YYYY-MM-DD, got "${date}"`, provenance: provenance() };
  }
  const resolved = tryResolve(model, provider);
  if (!resolved.ok) return { error: 'ambiguous_model', query: model, message: resolved.error, provenance: provenance() };
  if (!resolved.value) return notFound(model);
  const result = priceOn(model, date, provider ? { provider } : undefined);
  if (!result) return notFound(model);
  const view = priceView(result);
  if (!result.covered) {
    view.note = `"${result.model}" has no priced interval on ${date} (date predates its recorded coverage).`;
  }
  return view;
}

/** compare(models[], date?) - side-by-side prices for several model ids on one date (today by default). */
export function compare({ models, date }) {
  const on = date && date.length ? date : undefined;
  if (on && !ISO_DATE.test(on)) {
    return { error: 'bad_date', message: `date must be YYYY-MM-DD, got "${on}"`, provenance: provenance() };
  }
  const rows = (models ?? []).map((m) => {
    const resolved = tryResolve(m);
    if (!resolved.ok) return { query: m, error: 'ambiguous_model', message: resolved.error };
    if (!resolved.value) return { query: m, error: 'model_not_found' };
    const result = on ? priceOn(m, on) : current(m);
    if (!result) return { query: m, error: 'model_not_found' };
    return {
      query: m,
      provider: result.provider,
      model: result.model,
      date: result.date,
      covered: result.covered,
      input: sideView(result.input),
      output: sideView(result.output)
    };
  });
  return { date: on ?? 'today', count: rows.length, rows, provenance: provenance() };
}

/** cost_from_usage(tokens, model, date?, provider?) - value a token rollup at a point in time, with
 *  the shared cache multipliers (cache read 0.1x, write 1.25x/2x). Resolves the model id first so short
 *  ids work, then passes the canonical provider/model to the lib's usdForRollupRaw. */
export function costFromUsage({ model, tokens, date, provider }) {
  const on = date && date.length ? date : new Date().toISOString().slice(0, 10);
  if (!ISO_DATE.test(on)) {
    return { error: 'bad_date', query: model, message: `date must be YYYY-MM-DD, got "${on}"`, provenance: provenance() };
  }
  const resolved = tryResolve(model, provider);
  if (!resolved.ok) return { error: 'ambiguous_model', query: model, message: resolved.error, provenance: provenance() };
  if (!resolved.value) return notFound(model, { tokens });
  const { provider: p, model: canonical } = resolved.value;
  const { usd, modelKnown } = usdForRollupRaw(tokens ?? {}, p, canonical, on);
  if (!modelKnown) {
    return notFound(model, { tokens, note: `"${canonical}" has no priced interval on ${on}.` });
  }
  if (!Number.isFinite(usd)) {
    return { error: 'bad_tokens', query: model, message: 'token counts must be finite, non-negative numbers', provenance: provenance() };
  }
  return {
    query: model,
    provider: p,
    model: canonical,
    date: on,
    tokens: tokens ?? {},
    usd: Number(usd.toFixed(6)),
    cents: Math.round(usd * 100),
    cache_multipliers: { read: 0.1, write_5m: 1.25, write_1h: 2 },
    provenance: provenance()
  };
}

/** list_models(provider?) - the known model ids (optionally filtered to one provider), with aliases. */
export function listModels({ provider } = {}) {
  let rows = libModels();
  if (provider) rows = rows.filter((m) => m.provider === provider);
  return {
    count: rows.length,
    provider: provider ?? 'all',
    models: rows,
    provenance: provenance()
  };
}
