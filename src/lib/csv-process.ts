import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { CSV_COLUMN_TO_KEY, type MetricKey } from '@/lib/metrics';
import { parse, format } from 'date-fns';

export interface ParsedRow {
  restaurant_id_external: string; // Zomato's integer ID as string
  restaurant_name: string;
  subzone: string;
  city: string;
  date: string; // ISO YYYY-MM-DD
  metrics: Partial<Record<MetricKey, number>>;
}

export interface RestaurantMatch {
  zomato_id: string;
  restaurant_name: string;
  subzone: string;
  city: string;
  existing_id: string | null; // UUID from Supabase, null if not yet created
}

export interface ParseResult {
  rows: ParsedRow[];
  matches: RestaurantMatch[];
  unknownMetrics: string[];
  errors: string[];
  groupCounts: Record<string, number>;
}

function parseDateCol(col: string): string | null {
  try {
    const cleaned = col.replace(',', '').trim();
    const d = parse(cleaned, 'd MMM yyyy', new Date());
    if (isNaN(d.getTime())) return null;
    return format(d, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0;
  const s = String(val).replace(/[\u20B9,%\s]/g, '').replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeRows(raw: Record<string, string>[]): ParsedRow[] {
  if (!raw.length) return [];

  // Find date columns
  const sampleKeys = Object.keys(raw[0]);
  const dateCols: { col: string; iso: string }[] = [];
  for (const col of sampleKeys) {
    const iso = parseDateCol(col);
    if (iso) dateCols.push({ col, iso });
  }
  if (!dateCols.length) throw new Error('No date columns found. Expected columns like "09 Jun, 2026".');

  // Group by (restaurant_id_external, date)
  const grouped = new Map<string, ParsedRow>();

  for (const row of raw) {
    const restaurantId = String(row['Restaurant ID'] ?? row['restaurant id'] ?? '').trim();
    const restaurantName = String(row['Restaurant name'] ?? row['restaurant name'] ?? '').trim();
    const subzone = String(row['Subzone'] ?? '').trim();
    const city = String(row['City'] ?? '').trim();
    const metricLabel = String(row['Metric'] ?? '').trim();

    if (!restaurantId || !metricLabel) continue;

    const metricKey = CSV_COLUMN_TO_KEY.get(metricLabel);

    for (const { col, iso } of dateCols) {
      const groupKey = `${restaurantId}__${iso}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          restaurant_id_external: restaurantId,
          restaurant_name: restaurantName,
          subzone,
          city,
          date: iso,
          metrics: {},
        });
      }
      if (metricKey) {
        const existing = grouped.get(groupKey)!;
        existing.metrics[metricKey] = toNumber(row[col]);
      }
    }
  }

  // Derive average_order_value
  for (const parsed of grouped.values()) {
    const sales = parsed.metrics['sales'] ?? 0;
    const orders = parsed.metrics['delivered_orders'] ?? 0;
    parsed.metrics['average_order_value'] = orders > 0 ? sales / orders : 0;
  }

  return Array.from(grouped.values());
}

export async function parseFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  const unknownMetrics = new Set<string>();
  let rawRows: Record<string, string>[] = [];

  // Parse file
  if (file.name.endsWith('.csv')) {
    await new Promise<void>((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          rawRows = result.data;
          if (result.errors.length) errors.push(...result.errors.map(e => e.message));
          resolve();
        },
        error: reject,
      });
    });
  } else if (file.name.match(/\.(xlsx|xls)$/i)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });
  } else {
    throw new Error('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
  }

  // Drop fully empty rows
  rawRows = rawRows.filter(row => Object.values(row).some(v => v !== '' && v !== null && v !== undefined));

  // Detect unknown metrics for reporting
  for (const row of rawRows) {
    const label = String(row['Metric'] ?? '').trim();
    if (label && !CSV_COLUMN_TO_KEY.has(label)) unknownMetrics.add(label);
  }

  const rows = normalizeRows(rawRows);

  // Count by Overview group
  const groupCounts: Record<string, number> = {};
  for (const row of rawRows) {
    const overview = String(row['Overview'] ?? 'Unknown').trim();
    groupCounts[overview] = (groupCounts[overview] ?? 0) + 1;
  }

  // Build restaurant matches against Supabase
  const uniqueRestaurants = new Map<string, { name: string; subzone: string; city: string }>();
  for (const row of rows) {
    uniqueRestaurants.set(row.restaurant_id_external, {
      name: row.restaurant_name,
      subzone: row.subzone,
      city: row.city,
    });
  }

  // Fetch existing restaurants by zomato_id
  const zomatoIds = Array.from(uniqueRestaurants.keys());
  const { data: existingByZomato } = await supabase
    .from('restaurants')
    .select('id, zomato_id, name')
    .in('zomato_id', zomatoIds);

  const zomatoIdToUuid = new Map((existingByZomato ?? []).map(r => [r.zomato_id, r.id]));

  const matches: RestaurantMatch[] = Array.from(uniqueRestaurants.entries()).map(([zid, info]) => ({
    zomato_id: zid,
    restaurant_name: info.name,
    subzone: info.subzone,
    city: info.city,
    existing_id: zomatoIdToUuid.get(zid) ?? null,
  }));

  return {
    rows,
    matches,
    unknownMetrics: Array.from(unknownMetrics),
    errors,
    groupCounts,
  };
}

export async function commitImport(
  result: ParseResult,
  uploadedFileId: string,
  userId: string,
  autoCreate: boolean = true
): Promise<{ imported: number; autoCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let autoCreated = 0;

  // Build zomato_id -> Supabase UUID map
  const idMap = new Map<string, string>();
  for (const match of result.matches) {
    if (match.existing_id) {
      idMap.set(match.zomato_id, match.existing_id);
    }
  }

  // Auto-create unmatched restaurants if enabled
  if (autoCreate) {
    const toCreate = result.matches
      .filter(m => !m.existing_id)
      .map(m => ({
        name: m.restaurant_name,
        display_name: m.restaurant_name,
        zomato_id: m.zomato_id,
        subzone: m.subzone,
        city: m.city,
        platform: 'zomato' as const,
        status: 'active' as const,
      }));

    if (toCreate.length > 0) {
      const { data: created, error } = await supabase
        .from('restaurants')
        .upsert(toCreate, { onConflict: 'zomato_id' })
        .select('id, zomato_id');

      if (error) {
        errors.push(`Failed to create restaurants: ${error.message}`);
      } else {
        for (const r of created ?? []) {
          if (r.zomato_id) idMap.set(r.zomato_id, r.id);
        }
        autoCreated = toCreate.length;
      }
    }
  }

  // Build daily_metrics upsert batch
  const metricsToUpsert = result.rows
    .filter(row => idMap.has(row.restaurant_id_external))
    .map(row => ({
      restaurant_id: idMap.get(row.restaurant_id_external)!,
      date: row.date,
      ...row.metrics,
    }));

  // Batch in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < metricsToUpsert.length; i += CHUNK) {
    const chunk = metricsToUpsert.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('daily_metrics')
      .upsert(chunk, { onConflict: 'restaurant_id,date' });
    if (error) errors.push(`Batch ${Math.floor(i / CHUNK) + 1}: ${error.message}`);
  }

  // Update uploaded_files status
  await supabase
    .from('uploaded_files')
    .update({ status: 'processed', row_count: metricsToUpsert.length })
    .eq('id', uploadedFileId);

  // Audit log
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'file_uploaded',
    target_type: 'file',
    target_id: uploadedFileId,
    metadata: { imported: metricsToUpsert.length, auto_created: autoCreated },
  });

  return { imported: metricsToUpsert.length, autoCreated, errors };
}

export async function createUploadedFile(
  file: File,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('uploaded_files')
    .insert({
      file_name: file.name,
      file_size: file.size,
      uploaded_by: userId,
      status: 'processing',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to log upload: ${error.message}`);
  return data.id;
}
