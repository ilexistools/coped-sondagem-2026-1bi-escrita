"""
Lê sondagem_Língua_Portuguesa_2026_06_03_12_59_50_Ensino_Fundamental.xlsx
(uma guia por DRE) e gera data/lp_sistema_de_escrita.json com os registros
filtrados por Proficiência = "Escrita" e Questão = "Sistema de escrita".

O JSON é salvo em formato compacto:

{
  "schema": ["d", "ec", "e", "t", "id", "n", "r", "a", "b"],
  "rows": [...]
}

Campos:
- d: Nome DRE
- ec: Código EOL Escola
- e: Nome Escola
- t: Nome Turma
- id: Código EOL Estudante
- n: Nome Estudante
- r: Resposta
- a: Ano
- b: Bimestre
"""

import json
import os
import pandas as pd

ARQUIVO = os.path.join(
    os.path.dirname(__file__),
    "extracao",
    "sondagem_Língua_Portuguesa_2026_06_03_12_59_50_Ensino_Fundamental.xlsx",
)
SAIDA = os.path.join(os.path.dirname(__file__), "data", "lp_sistema_de_escrita.json")

FILTRO_PROFICIENCIA = "Escrita"
FILTRO_QUESTAO = "Sistema de escrita"
SCHEMA = ["d", "ec", "e", "t", "id", "n", "r", "a", "b"]
COLUNAS_SAIDA = [
    "Nome DRE",
    "Código EOL Escola",
    "Nome Escola",
    "Nome Turma",
    "Código EOL Estudante",
    "Nome Estudante",
    "Resposta",
    "Ano",
    "Bimestre",
]

# Mapeamento: nome da guia -> (sigla, nome curto)
DRES = {
    "BUTANTA":            ("BT", "Butantã"),
    "CAMPO LIMPO":        ("CL", "Campo Limpo"),
    "CAPELA DO SOCORRO":  ("CS", "Capela do Socorro"),
    "FREGUESIABRASILANDIA": ("FB", "Freguesia/Brasilândia"),
    "GUAIANASES":         ("G",  "Guaianases"),
    "IPIRANGA":           ("IP", "Ipiranga"),
    "ITAQUERA":           ("IQ", "Itaquera"),
    "JACANATREMEMBE":     ("JT", "Jaçanã/Tremembé"),
    "PENHA":              ("PE", "Penha"),
    "PIRITUBAJARAGUA":    ("PJ", "Pirituba/Jaraguá"),
    "SANTO AMARO":        ("SA", "Santo Amaro"),
    "SAO MATEUS":         ("SM", "São Mateus"),
    "SAO MIGUEL":         ("MP", "São Miguel Paulista"),
}


def main():
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)

    xl = pd.ExcelFile(ARQUIVO, engine="openpyxl")
    registros = []

    for guia in xl.sheet_names:
        sigla, nome_curto = DRES.get(guia, (guia, guia))

        df = xl.parse(guia, dtype=str)
        df.columns = df.columns.str.strip()

        mascara = (
            (df["Proficiência"].str.strip() == FILTRO_PROFICIENCIA) &
            (df["Questão"].str.strip() == FILTRO_QUESTAO)
        )
        filtrado = df[mascara].copy()
        filtrado["Sigla DRE"] = sigla
        filtrado["Nome DRE"] = nome_curto

        saida = filtrado[COLUNAS_SAIDA].astype(object)
        saida = saida.where(saida.notna(), None)
        registros.extend(saida.values.tolist())
        print(f"  [{sigla}] {nome_curto}: {len(filtrado)} registros")

    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(
            {"schema": SCHEMA, "rows": registros},
            f,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    print(f"\nTotal: {len(registros)} registros -> {SAIDA}")


if __name__ == "__main__":
    main()
