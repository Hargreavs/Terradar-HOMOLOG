"""
process-cnuc.py

Processa shapefile CNUC/MMA → GeoJSON simplificado para ingestão no PostGIS.

Dependências: pip install pyshp shapely

Uso:
  python server/scripts/process-cnuc.py <caminho_shapefile> [tolerancia]
  python server/scripts/process-cnuc.py data/shapefiles/cnuc_2025_08.shp 0.005

Saída: data/geo/cnuc_simplified.geojson
"""
import sys
import json
import os

import shapefile
from shapely.geometry import MultiPolygon, shape
from shapely.validation import make_valid

# ── Mapeamento categoria CNUC → abreviação TERRADAR ──
CATEGORIA_MAP = {
    "Estação Ecológica": "ESEC",
    "Monumento Natural": "MONA",
    "Parque": "PARNA",
    "Refúgio de Vida Silvestre": "REVIS",
    "Reserva Biológica": "REBIO",
    "Área de Proteção Ambiental": "APA",
    "Área de Relevante Interesse Ecológico": "ARIE",
    "Floresta": "FLONA",
    "Reserva Extrativista": "RESEX",
    "Reserva de Desenvolvimento Sustentável": "RDS",
    "Reserva Particular do Patrimônio Natural": "RPPN",
    "Reserva de Fauna": "REFAU",
}

GRUPO_MAP = {
    "Proteção Integral": "PI",
    "Uso Sustentável": "US",
}


def main():
    shp_path = sys.argv[1] if len(sys.argv) > 1 else "data/shapefiles/cnuc_2025_08.shp"
    tolerance = float(sys.argv[2]) if len(sys.argv) > 2 else 0.005

    output_path = "data/geo/cnuc_simplified.geojson"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print(f"Lendo {shp_path} (encoding latin-1)...")
    sf = shapefile.Reader(shp_path, encoding="latin-1")
    fields = [f[0] for f in sf.fields[1:]]

    features = []
    skipped = 0

    for i, (sr, rec) in enumerate(zip(sf.iterShapes(), sf.iterRecords())):
        if sr.shapeType == 0:  # Null geometry
            skipped += 1
            continue

        d = dict(zip(fields, rec))

        grupo_raw = str(d.get("grupo", "")).strip()
        cat_raw = str(d.get("categoria", "")).strip()
        esfera = str(d.get("esfera", "")).strip()
        nome = str(d.get("nome_uc", "")).strip()
        org_gestor = str(d.get("org_gestor", "")).strip()
        uf = str(d.get("uf", "")).strip()
        situacao = str(d.get("situacao", "")).strip()

        if situacao and situacao.lower() in ("desativado", "extinta"):
            skipped += 1
            continue

        grupo_code = GRUPO_MAP.get(grupo_raw, "US")
        cat_code = CATEGORIA_MAP.get(cat_raw, (cat_raw[:5] or "?").upper())
        categoria = f"{grupo_code} ({cat_code})"

        orgao = f"{esfera} - {org_gestor}" if org_gestor else esfera

        try:
            geom = shape(sr.__geo_interface__)
            if not geom.is_valid:
                geom = make_valid(geom)
            geom_simple = geom.simplify(tolerance, preserve_topology=True)

            if geom_simple.geom_type == "Polygon":
                geom_simple = MultiPolygon([geom_simple])
            elif geom_simple.geom_type == "GeometryCollection":
                polys = [
                    g
                    for g in geom_simple.geoms
                    if g.geom_type in ("Polygon", "MultiPolygon")
                ]
                if not polys:
                    skipped += 1
                    continue
                all_polys = []
                for p in polys:
                    if p.geom_type == "Polygon":
                        all_polys.append(p)
                    else:
                        all_polys.extend(p.geoms)
                geom_simple = MultiPolygon(all_polys)

            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "tipo": "UC",
                        "nome": nome,
                        "categoria": categoria,
                        "orgao": orgao,
                        "uf": uf,
                    },
                    "geometry": geom_simple.__geo_interface__,
                }
            )

        except Exception as e:
            print(f"  ERRO geometria #{i} ({nome}): {e}")
            skipped += 1
            continue

        if (i + 1) % 500 == 0:
            print(f"  Processados {i + 1}...")

    geojson = {"type": "FeatureCollection", "features": features}

    print(f"Salvando {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(
        f"OK: {len(features)} UCs processadas, {skipped} puladas, {size_mb:.1f} MB"
    )
    print("\nCategorias presentes:")
    cats = {}
    for feat in features:
        c = feat["properties"]["categoria"]
        cats[c] = cats.get(c, 0) + 1
    for k, v in sorted(cats.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
