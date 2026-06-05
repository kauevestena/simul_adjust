import fitz

doc = fitz.open('../../source_info/tese_embasamento.pdf')

for i in range(130, 150):
    page = doc[i]
    tabs = page.find_tables()
    for tab in tabs:
        data = tab.extract()
        for row in data:
            if row[0] and ('Linha' in row[0] or 'Linhas' in row[0]):
                print(f"Page {i}")
                print(row)
