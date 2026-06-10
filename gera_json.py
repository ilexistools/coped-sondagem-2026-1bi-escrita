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
- n: Primeiro nome do estudante
- r: Resposta
- a: Ano
- b: Bimestre
"""

import json
import os
from openpyxl import load_workbook

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

    wb = load_workbook(ARQUIVO, read_only=True, data_only=True)
    registros = []

    for guia in wb.sheetnames:
        sigla, nome_curto = DRES.get(guia, (guia, guia))

        ws = wb[guia]
        linhas = ws.iter_rows(values_only=True)
        cabecalhos = [str(valor).strip() if valor is not None else "" for valor in next(linhas)]
        indices = {nome: cabecalhos.index(nome) for nome in set(COLUNAS_SAIDA + ["Proficiência", "Questão"])}
        total_guia = 0

        for linha in linhas:
            proficiencia = normalizar_texto(linha[indices["Proficiência"]])
            questao = normalizar_texto(linha[indices["Questão"]])
            if proficiencia != FILTRO_PROFICIENCIA or questao != FILTRO_QUESTAO:
                continue

            registro = []
            for coluna in COLUNAS_SAIDA:
                if coluna == "Nome DRE":
                    valor = nome_curto
                else:
                    valor = linha[indices[coluna]]
                if coluna == "Nome Estudante":
                    valor = primeiro_nome(valor)
                registro.append(normalizar_saida(valor))

            registros.append(registro)
            total_guia += 1

        print(f"  [{sigla}] {nome_curto}: {total_guia} registros")

    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(
            {"schema": SCHEMA, "rows": registros},
            f,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        )

    print(f"\nTotal: {len(registros)} registros -> {SAIDA}")


def normalizar_texto(valor):
    return str(valor or "").strip()


def normalizar_saida(valor):
    texto = normalizar_texto(valor)
    return texto if texto else None


def primeiro_nome(nome):
    texto = str(nome or "").strip()
    return texto.split()[0] if texto else "Aluno"


if __name__ == "__main__":
    main()
