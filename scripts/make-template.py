"""Modèle de tableur Orvia (docs/modele-orvia.xlsx) : onglets Mode d'emploi, Opérations (format de l'export CSV)
et Synthèse (formules par métal et par année). Usage : python3 scripts/make-template.py exemple.csv docs/modele-orvia.xlsx"""
import csv
import datetime as dt
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

src, out = sys.argv[1], sys.argv[2]
F = 'Arial'
GOLD = 'B8902C'
DARK = '1D1F24'
head_font = Font(name=F, bold=True, color='F3E7C4', size=10)
head_fill = PatternFill('solid', fgColor=DARK)
input_fill = PatternFill('solid', fgColor='FFFF00')
blue = Font(name=F, color='0000FF', size=10)
base = Font(name=F, size=10)
bold = Font(name=F, size=10, bold=True)
thin = Side(style='thin', color='D9D2BF')
line = Border(bottom=thin)

wb = Workbook()

# ——— Mode d'emploi ———
doc = wb.active
doc.title = "Mode d'emploi"
lines = [
    ('Modèle de tableur Orvia', Font(name=F, size=16, bold=True, color=GOLD)),
    ('Pour analyser l’export CSV de l’appli (Profil › Relevés › Exporter en CSV).', base),
    ('', base),
    ('1. Onglet « Opérations » : remplacez les lignes d’exemple par votre export.', bold),
    ('   Google Sheets : Fichier › Importer › Importer › votre fichier .csv › « Remplacer la feuille actuelle »,', base),
    ('   séparateur « Point-virgule ». Excel : Données › À partir d’un fichier texte/CSV, séparateur « ; », puis copier-coller.', base),
    ('   Gardez la ligne d’en-tête : les colonnes doivent rester dans le même ordre (A à L).', base),
    ('2. Onglet « Synthèse » : saisissez les cellules jaunes (cours du jour en €/g, compte à analyser).', bold),
    ('   Tout le reste se calcule seul : grammes détenus, prix moyen payé, frais, impôts, plus-value, par métal et par année.', base),
    ('', base),
    ('Code couleur : texte bleu = valeurs saisies (ou importées) ; texte noir = formules ; fond jaune = à renseigner.', base),
    ('Les lignes livrées dans « Opérations » sont des exemples fictifs, pour montrer le format.', base),
    ('', base),
    ('Colonnes de l’export', bold),
    ('Grammes : positif = métal entré sur le compte, négatif = sorti. Montant : en euros, frais compris (achat) ou', base),
    ('valeur du métal (frais de garde, d’oxydation, conversion, versement famille). Frais et Impôt : en euros.', base),
    ('Prix au gramme : cours du métal hors frais au moment de l’opération.', base),
    ('', base),
    ('Plus-value latente = valeur au cours saisi − grammes détenus × prix moyen payé (frais d’achat compris).', base),
    ('Estimation avant frais de revente et impôt ; l’appli (Plus-value et impôts) fait le calcul exact lot par lot.', base),
    ('Exonéré en : l’impôt sur la plus-value disparaît après 22 ans de détention (abattement de 5 %/an dès la 3e année).', base),
]
for i, (text, font) in enumerate(lines, start=1):
    c = doc.cell(row=i, column=1, value=text)
    c.font = font
doc.column_dimensions['A'].width = 120

# ——— Opérations ———
ops = wb.create_sheet('Opérations')
with open(src, encoding='utf-8-sig') as fh:
    rows = list(csv.reader(fh, delimiter=';'))
header, data = rows[0], rows[1:]
ops.append(header)
for c in ops[1]:
    c.font = head_font
    c.fill = head_fill
    c.alignment = Alignment(vertical='center', wrap_text=True)
num = lambda s: float(s.replace(',', '.')) if s else None
for r in data:
    d, m, y = (int(x) for x in r[0].split('/'))
    ops.append([dt.date(y, m, d), int(r[1]), r[2], r[3], r[4], r[5], num(r[6]), num(r[7]), num(r[8]), num(r[9]), num(r[10]), r[11] or None])
fmt = {1: 'DD/MM/YYYY', 2: '0', 7: '#,##0.000000;-#,##0.000000;-', 8: '#,##0.0000 €;-#,##0.0000 €;-', 9: '#,##0.00 €;-#,##0.00 €;-', 10: '#,##0.00 €;-#,##0.00 €;-', 11: '#,##0.00 €;-#,##0.00 €;-'}
for row in ops.iter_rows(min_row=2):
    for c in row:
        c.font = blue
        c.border = line
        if c.column in fmt:
            c.number_format = fmt[c.column]
widths = [12, 7, 18, 44, 18, 11, 13, 15, 13, 11, 11, 16]
for i, w in enumerate(widths, start=1):
    ops.column_dimensions[get_column_letter(i)].width = w
ops.freeze_panes = 'A2'
ops.auto_filter.ref = f'A1:L{len(data) + 1}'

# ——— Synthèse ———
sy = wb.create_sheet('Synthèse')
O = "'Opérations'"
col = lambda c: f'{O}!${c}:${c}'
sy['A1'] = 'Synthèse de l’épargne'
sy['A1'].font = Font(name=F, size=16, bold=True, color=GOLD)
sy['A3'] = 'Compte analysé'
sy['B3'] = 'Compte principal'
sy['C3'] = '« Compte principal », le prénom d’un enfant, ou * pour tous les comptes'
sy['A4'] = 'Cours Gold Spot (€/g)'
sy['B4'] = 110
sy['A5'] = 'Cours argent (€/g)'
sy['B5'] = 1.4
sy['A6'] = 'Cours platine (€/g)'
sy['B6'] = 40
sy['C4'] = 'Cours du jour à saisir (écran Cours de l’appli). Valeurs d’exemple.'
for ref in ('B3', 'B4', 'B5', 'B6'):
    sy[ref].font = blue
    sy[ref].fill = input_fill
for ref in ('A3', 'A4', 'A5', 'A6'):
    sy[ref].font = bold
for ref in ('C3', 'C4'):
    sy[ref].font = Font(name=F, size=9, italic=True, color='7A7F8C')
for ref in ('B4', 'B5', 'B6'):
    sy[ref].number_format = '#,##0.000 €'
dv = DataValidation(type='decimal', operator='greaterThanOrEqual', formula1='0', showErrorMessage=True, errorTitle='Cours', error='Saisissez un cours positif en €/g.')
sy.add_data_validation(dv)
dv.add('B4:B6')

H1 = 8
cols = ['Métal', 'Grammes détenus', 'Grammes achetés', 'Investi (€)', 'Frais d’achat (€)', 'Garde et oxydation (€)', 'Impôt retenu (€)', 'Prix moyen payé (€/g)', 'Cours (€/g)', 'Valeur (€)', 'Plus-value latente (€)', 'Plus-value (%)']
sy.cell(row=H1 - 1, column=1, value='Par métal').font = Font(name=F, size=12, bold=True, color=GOLD)
for i, h in enumerate(cols, start=1):
    c = sy.cell(row=H1, column=i, value=h)
    c.font = head_font
    c.fill = head_fill
    c.alignment = Alignment(wrap_text=True, vertical='center')
acct = '$B$3'
for k, (metal, price) in enumerate([('Gold Spot', '$B$4'), ('Argent', '$B$5'), ('Platine', '$B$6')]):
    r = H1 + 1 + k
    sy.cell(row=r, column=1, value=metal).font = bold
    f = {
        2: f'=SUMIFS({col("G")},{col("F")},$A{r},{col("C")},{acct})',
        3: f'=SUMIFS({col("G")},{col("F")},$A{r},{col("E")},"Achat",{col("C")},{acct})',
        4: f'=SUMIFS({col("I")},{col("F")},$A{r},{col("E")},"Achat",{col("C")},{acct})',
        5: f'=SUMIFS({col("J")},{col("F")},$A{r},{col("E")},"Achat",{col("C")},{acct})',
        6: f'=SUMIFS({col("I")},{col("F")},$A{r},{col("E")},"Frais de garde",{col("C")},{acct})+SUMIFS({col("I")},{col("F")},$A{r},{col("E")},"Frais d’oxydation",{col("C")},{acct})',
        7: f'=SUMIFS({col("K")},{col("F")},$A{r},{col("C")},{acct})',
        8: f'=IFERROR(D{r}/C{r},0)',
        9: f'={price}',
        10: f'=B{r}*I{r}',
        11: f'=J{r}-B{r}*H{r}',
        12: f'=IFERROR(K{r}/(B{r}*H{r}),0)',
    }
    for c_, formula in f.items():
        cell = sy.cell(row=r, column=c_, value=formula)
        cell.font = base
        cell.border = line
tot = H1 + 4
sy.cell(row=tot, column=1, value='Total').font = bold
for c_ in (4, 5, 6, 7, 10, 11):
    L = get_column_letter(c_)
    sy.cell(row=tot, column=c_, value=f'=SUM({L}{H1 + 1}:{L}{H1 + 3})').font = bold
sy.cell(row=tot, column=12, value=f'=IFERROR(K{tot}/(J{tot}-K{tot}),0)').font = bold
for r in range(H1 + 1, tot + 1):
    sy.cell(row=r, column=2).number_format = '#,##0.000 "g"'
    sy.cell(row=r, column=3).number_format = '#,##0.000 "g"'
    for c_ in (4, 5, 6, 7, 10, 11):
        sy.cell(row=r, column=c_).number_format = '#,##0.00 €;-#,##0.00 €;-'
    sy.cell(row=r, column=8).number_format = '#,##0.000 €'
    sy.cell(row=r, column=9).number_format = '#,##0.000 €'
    sy.cell(row=r, column=12).number_format = '0.0%;-0.0%;-'

H2 = tot + 3
sy.cell(row=H2 - 1, column=1, value='Par année').font = Font(name=F, size=12, bold=True, color=GOLD)
cols2 = ['Année', 'Investi (€)', 'Frais d’achat (€)', 'Garde et oxydation (€)', 'Impôt retenu (€)', 'Gold Spot acheté (g)', 'Argent acheté (g)', 'Platine acheté (g)', 'Exonéré de plus-value en']
for i, h in enumerate(cols2, start=1):
    c = sy.cell(row=H2, column=i, value=h)
    c.font = head_font
    c.fill = head_fill
    c.alignment = Alignment(wrap_text=True, vertical='center')
first_year = min(int(r[1]) for r in data)
years = list(range(first_year, first_year + 25))
for k, y in enumerate(years):
    r = H2 + 1 + k
    yc = sy.cell(row=r, column=1, value=y)
    yc.font = bold
    f = {
        2: f'=SUMIFS({col("I")},{col("B")},$A{r},{col("E")},"Achat",{col("C")},{acct})',
        3: f'=SUMIFS({col("J")},{col("B")},$A{r},{col("E")},"Achat",{col("C")},{acct})',
        4: f'=SUMIFS({col("I")},{col("B")},$A{r},{col("E")},"Frais de garde",{col("C")},{acct})+SUMIFS({col("I")},{col("B")},$A{r},{col("E")},"Frais d’oxydation",{col("C")},{acct})',
        5: f'=SUMIFS({col("K")},{col("B")},$A{r},{col("C")},{acct})',
        6: f'=SUMIFS({col("G")},{col("B")},$A{r},{col("F")},"Gold Spot",{col("E")},"Achat",{col("C")},{acct})',
        7: f'=SUMIFS({col("G")},{col("B")},$A{r},{col("F")},"Argent",{col("E")},"Achat",{col("C")},{acct})',
        8: f'=SUMIFS({col("G")},{col("B")},$A{r},{col("F")},"Platine",{col("E")},"Achat",{col("C")},{acct})',
        9: f'=A{r}+22',
    }
    for c_, formula in f.items():
        cell = sy.cell(row=r, column=c_, value=formula)
        cell.font = base
        cell.border = line
        cell.number_format = '#,##0.00 €;-#,##0.00 €;-' if c_ <= 5 else ('#,##0.000 "g";-#,##0.000 "g";-' if c_ <= 8 else '0')
    sy.cell(row=r, column=1).number_format = '0'
yt = H2 + 1 + len(years)
sy.cell(row=yt, column=1, value='Total').font = bold
for c_ in range(2, 9):
    L = get_column_letter(c_)
    cell = sy.cell(row=yt, column=c_, value=f'=SUM({L}{H2 + 1}:{L}{yt - 1})')
    cell.font = bold
    cell.number_format = sy.cell(row=H2 + 1, column=c_).number_format
sy.cell(row=yt + 1, column=1, value=f'Années {years[0]} à {years[-1]} : modifiez la première année (A{H2 + 1}) si votre épargne commence plus tôt, les suivantes suivent.').font = Font(name=F, size=9, italic=True, color='7A7F8C')
for k in range(1, len(years)):
    sy.cell(row=H2 + 1 + k, column=1, value=f'=A{H2 + k}+1')
sy.cell(row=H2 + 1, column=1).font = Font(name=F, size=10, bold=True, color='0000FF')
sy.cell(row=H2 + 1, column=1).fill = input_fill

for i, w in enumerate([22, 14, 14, 14, 14, 16, 14, 15, 13, 13, 16, 12], start=1):
    sy.column_dimensions[get_column_letter(i)].width = w
sy.row_dimensions[H1].height = 30
sy.row_dimensions[H2].height = 30
sy.freeze_panes = 'A3'

wb.move_sheet('Synthèse', offset=-1)
wb.active = 1
wb.save(out)
print('ok', len(data), 'lignes')
