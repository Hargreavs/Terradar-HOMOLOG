# -*- coding: utf-8 -*-
"""
Ingest CPT (Comissao Pastoral da Terra) - 3 planilhas prioritarias para cpt_eventos
via RPC ingest_cpt_eventos_batch.

Execucao: python scripts/ingest_cpt_eventos.py
Env: .env.local com VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.

Encoding: UTF-8 sem BOM.
"""
from __future__ import annotations

import os
import re
import traceback
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv('.env.local')

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
if not SUPABASE_URL:
    raise RuntimeError('VITE_SUPABASE_URL ou SUPABASE_URL ausente em .env.local')

SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

CPT_DIR = Path(os.environ.get("CPT_DATA_DIR", r"C:\Users\alex-\Terrae\data\CPT"))
CHUNK_SIZE = 200
SHEET_NAME = "Resultado da consulta"

supabase: Client | None = None


def _require_env() -> Client:
    global supabase
    if not SUPABASE_SERVICE_KEY:
        raise SystemExit(
            "Defina SUPABASE_SERVICE_ROLE_KEY em .env.local (service role)."
        )
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return supabase


def parse_municipio(s: Any) -> tuple[str | None, str | None]:
    if not s or pd.isna(s):
        return None, None
    m = re.match(r"^(.+?)\s*\(([A-Z]{2})\)\s*$", str(s).strip())
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, None


def to_int(v: Any) -> int | None:
    if v is None or pd.isna(v):
        return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def to_date(v: Any) -> str | None:
    if v is None or pd.isna(v):
        return None
    try:
        if isinstance(v, str):
            t = str(v).strip()
            return t[:10] if len(t) >= 10 else None
        if hasattr(v, "strftime"):
            return v.strftime("%Y-%m-%d")
        return str(v)[:10]
    except (ValueError, TypeError):
        return None


def clean(v: Any) -> str | None:
    if v is None or pd.isna(v):
        return None
    s = str(v).strip()
    return s if s else None


def row_strip_none(rec: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in rec.items() if v is not None}


def load_assassinatos(path: Path) -> list[dict[str, Any]]:
    df = pd.read_excel(path, sheet_name=SHEET_NAME, header=1, engine="openpyxl")
    df = df.dropna(subset=[df.columns[0]])
    df = df[df.iloc[:, 0].astype(str).str.match(r"^[A-Z]{2}$")]

    eventos: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        muni_raw = clean(row.get("Municipio Primario"))
        muni_nome, muni_uf = parse_municipio(muni_raw)
        uf = clean(row.get("Uf Sigla")) or muni_uf
        ano = to_int(row.get("Ano"))
        if not uf or not ano or not muni_nome:
            continue
        rec = {
            "tipo_categoria": "assassinato",
            "uf": uf,
            "municipio_nome": muni_nome,
            "ano": ano,
            "data_evento": to_date(row.get("Data")),
            "nome_conflito": clean(row.get("Nome Conflito")),
            "numero_pessoas": to_int(row.get("Numero De Pessoas")),
            "categoria_vitima": clean(row.get("Categoria Vitima Violencia")),
            "vitima_nome": clean(row.get("Nome Descricao")),
            "tipo_violencia": clean(row.get("Tipo De Violencia")),
            "eixo_violencia": clean(row.get("Eixos De Violencia")),
            "vitima_idade": to_int(row.get("Idade")),
            "vitima_genero": clean(row.get("Genero")),
            "vitima_raca_cor": clean(row.get("Raca Cor")),
            "categoria_causou": clean(row.get("Categoria Causou Acao")),
            "categoria_sofreu": clean(row.get("Categoria Sofreu Acao")),
            "arquivo_origem": path.name,
            "fonte": "CPT",
        }
        eventos.append(row_strip_none(rec))
    return eventos


def load_violencia_posse(path: Path) -> list[dict[str, Any]]:
    df = pd.read_excel(path, sheet_name=SHEET_NAME, header=1, engine="openpyxl")
    df = df.dropna(subset=[df.columns[0]])
    df = df[df.iloc[:, 0].astype(str).str.match(r"^\d{4}$")]

    eventos: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        muni_raw = clean(row.get("Municipio Primario"))
        muni_nome, muni_uf = parse_municipio(muni_raw)
        uf = clean(row.get("Uf Sigla")) or muni_uf
        ano = to_int(row.get("Ano"))
        if not uf or not ano or not muni_nome:
            continue
        vf_cols = [c for c in row.index if str(c).startswith("Vf ")]
        detalhes: dict[str, int] = {}
        for c in vf_cols:
            iv = to_int(row[c])
            if iv is not None:
                detalhes[str(c)] = iv

        rec = {
            "tipo_categoria": "violencia_posse",
            "uf": uf,
            "municipio_nome": muni_nome,
            "ano": ano,
            "regiao": clean(row.get("Regiao")),
            "data_evento": to_date(row.get("Data")),
            "nome_conflito": clean(row.get("Nome Conflito")),
            "tipo_violencia": clean(row.get("Tipo De Violencia")),
            "categoria_causou": clean(row.get("Categoria Causou Acao")),
            "categoria_sofreu": clean(row.get("Categoria Sofreu Acao")),
            "arquivo_origem": path.name,
            "fonte": "CPT",
        }
        if detalhes:
            rec["detalhes"] = detalhes
        eventos.append(row_strip_none(rec))
    return eventos


def load_trabalhistas(path: Path) -> list[dict[str, Any]]:
    df = pd.read_excel(path, sheet_name=SHEET_NAME, header=1, engine="openpyxl")
    df = df.dropna(subset=[df.columns[0]])
    df = df[df.iloc[:, 0].astype(str).str.match(r"^\d{4}$")]

    eventos: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        muni_raw = clean(row.get("Municipio Primario"))
        muni_nome, muni_uf = parse_municipio(muni_raw)
        uf = clean(row.get("Uf Sigla")) or muni_uf
        ano = to_int(row.get("Ano"))
        if not uf or not ano or not muni_nome:
            continue
        rec = {
            "tipo_categoria": "conflito_trabalhista",
            "uf": uf,
            "municipio_nome": muni_nome,
            "ano": ano,
            "regiao": clean(row.get("Regiao")),
            "data_evento": to_date(row.get("Data")),
            "nome_conflito": clean(row.get("Nome Conflito")),
            "forma_conflito": clean(row.get("Forma Conflito Trabalhista")),
            "numero_pessoas": to_int(row.get("Numero De Pessoas")),
            "trabalhadores_resgatados": to_int(row.get("Trabalhadores Resgatados")),
            "vitimas_morte": to_int(row.get("Vitimas Morte")),
            "arquivo_origem": path.name,
            "fonte": "CPT",
        }
        eventos.append(row_strip_none(rec))
    return eventos


def ingest_chunked(
    client: Client, eventos: list[dict[str, Any]], chunk_size: int = CHUNK_SIZE
) -> int:
    total = 0
    rpc_name = "ingest_cpt_eventos_batch"
    rpc_param_key = os.environ.get("CPT_INGEST_RPC_PARAM", "p_data")

    for i in range(0, len(eventos), chunk_size):
        batch = eventos[i : i + chunk_size]
        resp = client.rpc(rpc_name, {rpc_param_key: batch}).execute()
        inserted = getattr(resp, "data", None)
        if isinstance(inserted, int):
            n = inserted
        elif isinstance(inserted, str) and inserted.isdigit():
            n = int(inserted)
        else:
            n = len(batch)
        total += n
        chunk_no = i // chunk_size + 1
        print(f"  Chunk {chunk_no}: {n} retorno RPC (acumulado: {total})")
    return total


def truncate_cpt_eventos(client: Client) -> None:
    client.table("cpt_eventos").delete().neq("id", 0).execute()


ARQUIVOS = [
    ('Assassinatos 2016-2025xlsx.xlsx', load_assassinatos),
    ('VIOLÊNCIA À OCUPAÇÃO E A POSSE - BRASIL 2025.xlsx', load_violencia_posse),
    ('CONFLITOS TRABALHISTAS - BRASIL 2025.xlsx', load_trabalhistas),
]


def main() -> None:
    client = _require_env()
    CPT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"CPT dir: {CPT_DIR.resolve()}")

    print("Limpando cpt_eventos...")
    truncate_cpt_eventos(client)

    grand_total = 0
    for fname, loader in ARQUIVOS:
        path = CPT_DIR / fname
        print(f"\n=== {fname} ===")
        if not path.exists():
            print(f"  ERRO: arquivo nao encontrado: {path}")
            raise FileNotFoundError(str(path))

        eventos = loader(path)
        print(f"  Extraidos: {len(eventos)}")
        if eventos:
            inserted = ingest_chunked(client, eventos)
            grand_total += inserted

    print("\n" + "=" * 50)
    print(f"TOTAL RPC acumulado: {grand_total}")
    print("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("\n*** ERRO COMPLETO ***\n")
        traceback.print_exc()
        raise
