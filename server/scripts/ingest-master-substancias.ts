/**
 * ingest-master-substancias.ts
 * 
 * Ingere a planilha TERRADAR-Master-Substancias-v10.xlsx na tabela master_substancias do Supabase.
 * 
 * Uso:
 *   npx tsx server/scripts/ingest-master-substancias.ts
 * 
 * Pré-requisitos:
 *   - npm install xlsx (já instalado para ingest-capag.ts)
 *   - Tabela master_substancias criada no Supabase (ver SQL no doc de transferência)
 *   - .env.local com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * 
 * O arquivo XLSX deve estar em: data/TERRADAR-Master-Substancias-v10.xlsx
 * (ou passar caminho como argumento: npx tsx ... --file path/to/file.xlsx)
 */

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Carrega .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar no .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Parsing de argumentos ---
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const FILE_PATH = getArg("--file") || path.resolve(process.cwd(), "data", "TERRADAR-Master-Substancias-v10.xlsx");

// --- Helpers ---
function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "" || val === "N/A" || val === "NaN") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toBoolean(val: unknown): boolean {
  if (!val) return false;
  return String(val).trim().toLowerCase() === "sim";
}

function cleanText(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

// --- Main ---
async function main() {
  console.log("📂 Lendo arquivo:", FILE_PATH);

  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${FILE_PATH}`);
    console.error("   Coloque o XLSX em data/ ou use --file caminho/para/arquivo.xlsx");
    process.exit(1);
  }

  const buffer = fs.readFileSync(FILE_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets["TERRADAR Master"];
  if (!sheet) {
    console.error("❌ Aba 'TERRADAR Master' não encontrada no XLSX");
    process.exit(1);
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);
  console.log(`📊 ${rows.length} substâncias encontradas na planilha`);

  // Mapeia colunas do XLSX para colunas do banco
  const records = rows.map((row) => ({
    substancia_anm: cleanText(row["Substância ANM"]),
    familia: cleanText(row["Família"]) || "outros",
    cfem_pct: toNumber(row["CFEM (%)"]),
    preco_usd: toNumber(row["Preço USD/t"]),
    fonte_preco: cleanText(row["Fonte Preço"]),
    preco_brl: toNumber(row["Preço BRL/t"]),
    unidade_preco: cleanText(row["Unidade Preço"]) || "t",
    reservas_br_pct: toNumber(row["Reservas BR (%)"]),
    producao_br_pct: toNumber(row["Produção BR (%)"]),
    gap_pp: toNumber(row["Gap (p.p.)"]),
    fonte_res_prod: cleanText(row["Fonte Res/Prod"]),
    tendencia: cleanText(row["Tendência"]),
    var_1a_pct: toNumber(row["Var 1a (%)"]),
    cagr_5a_pct: toNumber(row["CAGR 5a (%)"]),
    estrategia_nacional: cleanText(row["Estratégia Nacional"]),
    sinal: cleanText(row["Sinal"]),
    aplicacoes: cleanText(row["Aplicações"]),
    teor_pct: toNumber(row["Teor (%)"]),
    val_reserva_usd_ha: toNumber(row["Val.Reserva USD/ha"]),
    val_reserva_brl_ha: toNumber(row["Val.Reserva BRL/ha"]),
    mineral_critico_2025: toBoolean(row["Mineral Crítico 2025"]),
    aplicacoes_usgs: cleanText(row["Aplicações USGS (MCS 2026)"]),
    cresc_demanda_cleantech_2030_pct: toNumber(row["Cresc. Demanda Cleantech 2030 (%)"]),
    demanda_projetada_2030: cleanText(row["Demanda Projetada 2030"]),
    cambio_referencia: 5.0229,
    updated_at: new Date().toISOString(),
  }));

  // Filtra registros sem substância (linhas vazias)
  const valid = records.filter((r) => r.substancia_anm);
  console.log(`✅ ${valid.length} registros válidos para inserir`);

  // Upsert em batches de 50
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("master_substancias")
      .upsert(batch, { onConflict: "substancia_anm" });

    if (error) {
      console.error(`❌ Erro no batch ${i / BATCH_SIZE + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r⏳ ${inserted}/${valid.length} inseridos...`);
    }
  }

  console.log();
  console.log("─".repeat(50));
  console.log(`✅ Ingestão completa: ${inserted} inseridos, ${errors} com erro`);
  console.log(`📋 Tabela: master_substancias`);
  console.log(`📅 Câmbio referência: R$ 5,0229 (PTAX 10/04/2026)`);

  // Resumo por família
  const familyCount: Record<string, number> = {};
  valid.forEach((r) => {
    const f = r.familia || "outros";
    familyCount[f] = (familyCount[f] || 0) + 1;
  });
  console.log("\n📊 Distribuição por família:");
  Object.entries(familyCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([f, c]) => console.log(`   ${f}: ${c}`));
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
