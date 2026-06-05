import fitz

doc = fitz.open('rede_gravimetrica/tese_embasamento.pdf')

# On page 39, we have equations of the form "l1 + Curitiba = São Mateus do Sul;"
# Also equations: "l2 = Bituruna - São Mateus do Sul;" etc.
# These actually define the gravimetric lines!
# Wait, do we have the ACTUAL measured relative values anywhere?
# The instructions say: "If there's no information about the gravimetric value, you leave it blank."

import csv

lines = []
with open('rede_gravimetrica/gravimetric_lines.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    for row in reader:
        lines.append(row)

# Let's clean up cities.csv to remove duplicates (e.g. Curitiba and Curitiba (PR))
# but we shouldn't necessarily remove them if they are both in the thesis?
# The prompt says: "extract the names of the cities that are mentioned in the thesis and create a list of them"
