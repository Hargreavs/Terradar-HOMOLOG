/**
 * ingest-geo-layers.ts
 *
 * Ingere camadas geoespaciais (shapefiles processados como GeoJSON)
 * nas tabelas geo_areas_protegidas, geo_infraestrutura, geo_pontos_interesse,
 * geo_biomas e geo_aquiferos.
 *
 * Usa conexão PostgreSQL direta (pg) para suportar ST_GeomFromGeoJSON.
 *
 * Uso:
 *   npx tsx server/scripts/ingest-geo-layers.ts
 *   npx tsx server/scripts/ingest-geo-layers.ts --layer tis
 *   npx tsx server/scripts/ingest-geo-layers.ts --layer ferrovias
 *
 * Layers disponíveis: tis, ucs, cnuc, quilombolas, ferrovias, rodovias, hidrovias, portos, biomas, aquiferos, all
 * (`all` usa CNUC completo em vez de ucs/ICMBio legado)
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL deve estar no .env.local");
  console.error("   Pegar em: Supabase Dashboard → Settings → Database → Connection string → URI");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const GEO_DIR = path.resolve(process.cwd(), "data", "geo");

// --- Tipos ---
interface GeoFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: Record<string, unknown>;
}

interface GeoJSON {
  type: string;
  features: GeoFeature[];
}

// --- Helpers ---
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

function readGeoJSON(filename: string): GeoJSON {
  const filepath = path.join(GEO_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Arquivo não encontrado: ${filepath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function clean(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

// --- Inserção em batch ---
async function insertAreas(features: GeoFeature[], label: string) {
  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  try {
    for (const feat of features) {
      const p = feat.properties;
      const geojson = JSON.stringify(feat.geometry);
      try {
        await client.query(
          `INSERT INTO geo_areas_protegidas (tipo, nome, categoria, orgao, uf, geom)
           VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4674))`,
          [
            clean(p.tipo),
            clean(p.nome),
            clean(p.categoria),
            clean(p.orgao),
            clean(p.uf),
            geojson,
          ]
        );
        inserted++;
        if (inserted % 100 === 0) process.stdout.write(`\r  ⏳ ${label}: ${inserted}/${features.length}...`);
      } catch (err: any) {
        errors++;
        if (errors <= 3) console.error(`\n  ⚠️ Erro em "${clean(p.nome)}": ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\r  ✅ ${label}: ${inserted} inseridos, ${errors} erros`);
  return inserted;
}

async function insertInfra(features: GeoFeature[], label: string) {
  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  try {
    for (const feat of features) {
      const p = feat.properties;
      const geojson = JSON.stringify(feat.geometry);
      try {
        await client.query(
          `INSERT INTO geo_infraestrutura (tipo, nome, categoria, geom)
           VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4674))`,
          [
            clean(p.tipo),
            clean(p.nome),
            clean(p.categoria),
            geojson,
          ]
        );
        inserted++;
        if (inserted % 500 === 0) process.stdout.write(`\r  ⏳ ${label}: ${inserted}/${features.length}...`);
      } catch (err: any) {
        errors++;
        if (errors <= 3) console.error(`\n  ⚠️ Erro em "${clean(p.nome)}": ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\r  ✅ ${label}: ${inserted} inseridos, ${errors} erros`);
  return inserted;
}

async function insertPortos(features: GeoFeature[], label: string) {
  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  // Garantir coluna categoria
  await client.query("ALTER TABLE geo_pontos_interesse ADD COLUMN IF NOT EXISTS categoria text");

  try {
    for (const feat of features) {
      const p = feat.properties;
      const geojson = JSON.stringify(feat.geometry);
      try {
        await client.query(
          `INSERT INTO geo_pontos_interesse (tipo, nome, categoria, uf, geom)
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4674))`,
          [
            clean(p.tipo),
            clean(p.nome),
            clean(p.categoria),
            clean(p.uf),
            geojson,
          ]
        );
        inserted++;
        if (inserted % 200 === 0) process.stdout.write(`\r  ⏳ ${label}: ${inserted}/${features.length}...`);
      } catch (err: any) {
        errors++;
        if (errors <= 3) console.error(`\n  ⚠️ Erro em "${clean(p.nome)}": ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\r  ✅ ${label}: ${inserted} inseridos, ${errors} erros`);
  return inserted;
}

async function insertBiomas(features: GeoFeature[], label: string) {
  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  try {
    for (const feat of features) {
      const p = feat.properties;
      const geojson = JSON.stringify(feat.geometry);
      try {
        await client.query(
          `INSERT INTO geo_biomas (nome, geom)
           VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4674))`,
          [clean(p.nome), geojson]
        );
        inserted++;
      } catch (err: any) {
        errors++;
        if (errors <= 3) console.error(`\n  ⚠️ Erro: ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\r  ✅ ${label}: ${inserted} inseridos, ${errors} erros`);
  return inserted;
}

async function insertAquiferos(features: GeoFeature[], label: string) {
  const client = await pool.connect();
  let inserted = 0;
  let errors = 0;

  try {
    for (const feat of features) {
      const p = feat.properties;
      const geojson = JSON.stringify(feat.geometry);
      try {
        await client.query(
          `INSERT INTO geo_aquiferos (nome, tipo, geom)
           VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4674))`,
          [clean(p.nome), clean(p.tipo), geojson]
        );
        inserted++;
        if (inserted % 500 === 0) process.stdout.write(`\r  ⏳ ${label}: ${inserted}/${features.length}...`);
      } catch (err: any) {
        errors++;
        if (errors <= 3) console.error(`\n  ⚠️ Erro: ${err.message}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\r  ✅ ${label}: ${inserted} inseridos, ${errors} erros`);
  return inserted;
}

/** Substitui todas as UCs em `geo_areas_protegidas` pelo dataset CNUC/MMA (GeoJSON pré-processado). */
async function ingestCnuc(): Promise<number> {
  const geojsonPath = path.join(GEO_DIR, "cnuc_simplified.geojson");

  if (!fs.existsSync(geojsonPath)) {
    console.error("❌ Arquivo cnuc_simplified.geojson não encontrado.");
    console.error(
      "   Rode primeiro: python server/scripts/process-cnuc.py data/shapefiles/cnuc_2025_08.shp 0.005",
    );
    process.exit(1);
  }

  console.log("Lendo cnuc_simplified.geojson...");
  const raw = fs.readFileSync(geojsonPath, "utf-8");
  const data = JSON.parse(raw) as GeoJSON;
  const features = data.features;
  console.log(`${features.length} UCs para inserir`);

  const client = await pool.connect();
  try {
    console.log("Deletando UCs existentes (tipo = UC)...");
    const del = await client.query(
      "DELETE FROM geo_areas_protegidas WHERE tipo = 'UC'",
    );
    console.log(`UCs antigas removidas (DELETE ${del.rowCount ?? 0}).`);
  } finally {
    client.release();
  }

  return insertAreas(features, "CNUC/MMA");
}

// --- Layer definitions ---
const LAYERS: Record<string, () => Promise<number>> = {
  tis: async () => {
    const data = readGeoJSON("ti_simplified.geojson");
    return insertAreas(data.features, "TIs (FUNAI)");
  },
  ucs: async () => {
    const data = readGeoJSON("uc_simplified.geojson");
    return insertAreas(data.features, "UCs (ICMBio)");
  },
  quilombolas: async () => {
    const data = readGeoJSON("quilombola_simplified.geojson");
    return insertAreas(data.features, "Quilombolas (INCRA)");
  },
  ferrovias: async () => {
    const data = readGeoJSON("ferrovias_simplified.geojson");
    return insertInfra(data.features, "Ferrovias");
  },
  rodovias: async () => {
    const data = readGeoJSON("rodovias_simplified.geojson");
    return insertInfra(data.features, "Rodovias (DNIT)");
  },
  hidrovias: async () => {
    const data = readGeoJSON("hidrovias_simplified.geojson");
    return insertInfra(data.features, "Hidrovias (ANTAQ)");
  },
  portos: async () => {
    const data = readGeoJSON("portos.geojson");
    return insertPortos(data.features, "Portos (ANTAQ)");
  },
  biomas: async () => {
    const data = readGeoJSON("biomas_simplified.geojson");
    return insertBiomas(data.features, "Biomas (IBGE)");
  },
  aquiferos: async () => {
    const data = readGeoJSON("aquiferos_simplified.geojson");
    return insertAquiferos(data.features, "Aquíferos (CPRM)");
  },
  cnuc: async () => ingestCnuc(),
};

/** Ordem para `--layer all`: CNUC substitui ingest `ucs` (ICMBio resumido). */
const ALL_LAYER_KEYS = [
  "tis",
  "quilombolas",
  "cnuc",
  "ferrovias",
  "rodovias",
  "hidrovias",
  "portos",
  "biomas",
  "aquiferos",
] as const;

// --- Main ---
async function main() {
  const targetLayer = getArg("--layer") || "all";

  console.log("🌍 TERRADAR — Ingestão de camadas geoespaciais");
  console.log(`📂 Diretório: ${GEO_DIR}`);
  console.log(`🎯 Layer: ${targetLayer}`);
  console.log("─".repeat(50));

  let totalInserted = 0;

  if (targetLayer === "all") {
    for (const name of ALL_LAYER_KEYS) {
      const fn = LAYERS[name];
      if (fn) totalInserted += await fn();
    }
  } else if (LAYERS[targetLayer]) {
    totalInserted = await LAYERS[targetLayer]();
  } else {
    console.error(`❌ Layer "${targetLayer}" não encontrada.`);
    console.error(
      `   Disponíveis: ${Object.keys(LAYERS).join(", ")}, all`,
    );
    process.exit(1);
  }

  console.log("─".repeat(50));
  console.log(`✅ Total: ${totalInserted} registros inseridos`);

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  pool.end();
  process.exit(1);
});
