// The cast. Old-fashioned Brazilian names, chosen because they are affectionate
// and a little grandiose — the humour is nostalgia, never mockery of the people
// who carry these names.
//
// The pools are larger than the six parcels need, so a different seed gives a
// different cast and the campaign does not feel prefabricated.

export const OWNER_NAMES = [
  'Epaminondas Ermenegildo',
  'Gertrudes Dorvalina',
  'Firmino Anacleto',
  'Idalina Bernardete',
  'Ozéias Nepomuceno',
  'Genoveva Aparecida',
  'Belarmino Sinfrônio',
  'Etelvina Zuleica',
  'Aristides Balbino',
  'Rosalvo Deodato',
  'Maria Ondina Pafúncia',
  'Hermenegildo Quirino',
  'Jovelina Sebastiana',
  'Teotônio Anastácio',
  'Doralice Filomena',
  'Waldemar Zeferino',
];

export const PROPERTY_NAMES = [
  'Sítio Boa Esperança',
  'Fazenda Santa Gertrudes',
  'Chácara Recanto do Sabiá',
  'Sítio Três Barras',
  'Fazenda Água Limpa',
  'Chácara Beira-Córrego',
  'Sítio Pau-d’Alho',
  'Fazenda Bom Retiro',
  'Sítio Cantinho do Céu',
  'Chácara Vista Alegre',
];

/** Things a parcel can border that are not another player-surveyed parcel. */
export const EXTERIOR_FEATURES = [
  { key: 'estrada', pt: 'Estrada Municipal Zé do Cupim', en: 'Zé do Cupim Municipal Road' },
  { key: 'corrego', pt: 'Córrego das Almas', en: 'Córrego das Almas (creek)' },
  { key: 'terras1', pt: 'terras de Waldemar Sinval', en: 'lands of Waldemar Sinval' },
  { key: 'terras2', pt: 'terras de Benedita Escolástica', en: 'lands of Benedita Escolástica' },
  { key: 'rodovia', pt: 'Rodovia Estadual PR-999', en: 'State Highway PR-999' },
  { key: 'terras3', pt: 'terras do Espólio de Januário Peçanha', en: 'lands of the Januário Peçanha Estate' },
];

export const MUNICIPIOS = [
  'Vila dos Confins',
  'Santo Antônio do Rio Torto',
  'Bom Jesus da Serra Azul',
  'Campo do Meio de Cima',
];

export const UF = 'PR';

/**
 * Deal out a cast for one world. Owners and property names are paired and
 * shuffled together so the same seed always tells the same story.
 */
export function dealCast(rng, count) {
  const owners = rng.shuffle([...OWNER_NAMES]).slice(0, count);
  const properties = rng.shuffle([...PROPERTY_NAMES]).slice(0, count);
  const municipio = rng.pick(MUNICIPIOS);
  const exteriors = rng.shuffle([...EXTERIOR_FEATURES]);
  return { owners, properties, municipio, uf: UF, exteriors };
}

/** How a neighbouring parcel is named in a memorial descritivo. */
export function confrontanteLabel(parcel, lang = 'pt') {
  if (!parcel) return '';
  return lang === 'pt'
    ? `${parcel.propertyName}, de propriedade de ${parcel.owner}`
    : `${parcel.propertyName}, owned by ${parcel.owner}`;
}

/** How an exterior feature is named. */
export const exteriorLabel = (feature, lang = 'pt') => (feature ? feature[lang] || feature.pt : '');
