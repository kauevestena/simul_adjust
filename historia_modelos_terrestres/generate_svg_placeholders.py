import os

figures = {
    'pitagoras': 'Pitágoras de Samos',
    'aristoteles': 'Aristóteles',
    'ptolomeu': 'Cláudio Ptolomeu',
    'eratostenes': 'Eratóstenes de Cirene',
    'newton': 'Isaac Newton',
    'clairaut': 'Alexis Claude Clairaut',
    'maupertuis': 'Pierre-Louis de Maupertuis',
    'bessel': 'Friedrich Wilhelm Bessel',
    'listing': 'Johann Benedict Listing',
    'stokes': 'Sir George Gabriel Stokes',
    'helmert': 'Friedrich Robert Helmert',
    'molodensky': 'Mikhail Sergeevich Molodensky',
    'heiskanen': 'Veikko Aleksanteri Heiskanen',
    'moritz': 'Helmut Moritz',
    'mercator': 'Gerardus Mercator',
    'lambert': 'Johann Heinrich Lambert',
    'gauss': 'Carl Friedrich Gauss',
    'kruger': 'Johann Heinrich Louis Krüger'
}

illustrations = {
    'pitagoras': 'A Harmonia das Esferas',
    'aristoteles': 'Sombra Circular em Eclipse',
    'ptolomeu': 'Modelo Geocêntrico (Epiciclos)',
    'eratostenes': 'Medição da Sombra em Alexandria/Siena',
    'newton': 'Achatamento Polar (Força Centrífuga)',
    'clairaut': 'Gravidade no Elipsóide (Teorema)',
    'maupertuis': 'Medição de Arco na Lapônia',
    'bessel': 'O Elipsóide de Referência',
    'listing': 'Ondulação do Geóide',
    'stokes': 'Integração de Anomalias de Gravidade',
    'helmert': 'A Geodésia Física Clássica',
    'molodensky': 'O Teluróide e Anomalias de Altura',
    'heiskanen': 'Compensação Isostática (Raízes)',
    'moritz': 'Colocação por Mínimos Quadrados',
    'mercator': 'Projeção Cilíndrica Conforme',
    'lambert': 'Projeção Cônica de 2 Paralelos',
    'gauss': 'Mapeamento Conforme de Superfícies',
    'kruger': 'Séries e Fórmulas UTM'
}

def create_svg(filename, text, width, height, is_portrait=False):
    # Colors
    bg = '#1e293b' if not is_portrait else '#0f172a'
    text_color = '#38bdf8'
    
    # Initials for portrait
    if is_portrait:
        words = text.split()
        initials = words[0][0] + (words[-1][0] if len(words) > 1 else '')
        content = f'<text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="64" fill="{text_color}" font-weight="bold" font-family="sans-serif">{initials.upper()}</text>'
        content += f'<text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#94a3b8" font-family="sans-serif">{text}</text>'
    else:
        # Wrap text if too long (simplified)
        content = f'<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="{text_color}" font-weight="bold" font-family="sans-serif">{text}</text>'
        content += f'<rect x="10%" y="10%" width="80%" height="80%" fill="none" stroke="#334155" stroke-width="2" rx="10"/>'

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
        <rect width="100%" height="100%" fill="{bg}"/>
        {content}
    </svg>'''
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(svg)

os.makedirs('img/figures', exist_ok=True)

# Process portraits
for key, name in figures.items():
    filename = f"img/figures/{key}_portrait.webp"
    if not os.path.exists(filename) or os.path.getsize(filename) < 1000:
        print(f"Creating placeholder for {key} portrait")
        create_svg(filename, name, 300, 400, True)

# Process illustrations
for key, title in illustrations.items():
    filename = f"img/figures/{key}_illust.webp"
    if not os.path.exists(filename) or os.path.getsize(filename) < 1000:
        print(f"Creating placeholder for {key} illustration")
        create_svg(filename, title, 600, 400, False)

print("Done generating SVGs")
