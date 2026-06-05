import fitz

doc = fitz.open('../../source_info/tese_embasamento.pdf')

for i in range(120, 130):
    page = doc[i]
    tabs = page.find_tables()
    for tab in tabs:
        data = tab.extract()
        if data and 'l1' in str(data):
            for row in data:
                print(row)
