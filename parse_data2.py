import fitz

doc = fitz.open('rede_gravimetrica/tese_embasamento.pdf')

page121_tabs = doc[121].find_tables()
ajustamento_cities = []
for tab in page121_tabs:
    data = tab.extract()
    for row in data:
        print(row)
