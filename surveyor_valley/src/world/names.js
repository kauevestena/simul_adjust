// The cast. Old-fashioned Brazilian names, chosen because they are affectionate
// and a little grandiose — the humour is nostalgia, never mockery of the people
// who carry these names.
//
// The pools are larger than the six parcels need, so a different seed gives a
// different cast and the campaign does not feel prefabricated.

/**
 * `body` is which silhouette the owner is painted with when they are standing
 * on their own doorstep waiting to be paid. It is carried here, beside the
 * name, rather than derived from it: a name is not a reliable guide to anybody,
 * and the alternative — guessing from the ending of "Epaminondas" — would be
 * both wrong sometimes and wrong in a way that reads as carelessness about the
 * people these names belong to. Authored data, one field, no inference.
 */
export const OWNER_NAMES = [
  { name: 'Epaminondas Ermenegildo', body: 'm' },
  { name: 'Gertrudes Dorvalina', body: 'f' },
  { name: 'Firmino Anacleto', body: 'm' },
  { name: 'Idalina Bernardete', body: 'f' },
  { name: 'Ozéias Nepomuceno', body: 'm' },
  { name: 'Genoveva Aparecida', body: 'f' },
  { name: 'Belarmino Sinfrônio', body: 'm' },
  { name: 'Etelvina Zuleica', body: 'f' },
  { name: 'Aristides Balbino', body: 'm' },
  { name: 'Rosalvo Deodato', body: 'm' },
  { name: 'Maria Ondina Pafúncia', body: 'f' },
  { name: 'Hermenegildo Quirino', body: 'm' },
  { name: 'Jovelina Sebastiana', body: 'f' },
  { name: 'Teotônio Anastácio', body: 'm' },
  { name: 'Doralice Filomena', body: 'f' },
  { name: 'Waldemar Zeferino', body: 'm' },
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
  const cast = rng.shuffle([...OWNER_NAMES]).slice(0, count);
  const properties = rng.shuffle([...PROPERTY_NAMES]).slice(0, count);
  const municipio = rng.pick(MUNICIPIOS);
  const exteriors = rng.shuffle([...EXTERIOR_FEATURES]);
  // `owners` stays a list of plain strings: it signs memoriais, names
  // confrontantes and is compared in a dozen places, and none of them want an
  // object. `ownerBodies` runs alongside it for the one caller that paints a
  // face — see `world.js#placeResidents`.
  return {
    owners: cast.map((o) => o.name),
    ownerBodies: cast.map((o) => o.body),
    properties,
    municipio,
    uf: UF,
    exteriors,
  };
}

/**
 * The player's own name.
 *
 * A different joke from the landowners', and deliberately so: they are
 * nostalgic and grandiose, the surveyor is a sporting hero with the wrong
 * surname. First names and surnames are drawn from Brazilian athletes and then
 * dealt independently, so what comes out is "Ayrton Fittipaldi" or "Marta
 * Kuerten" — recognisable halves that never belonged together.
 *
 * It matters beyond the joke. `state.player.name` is what signs the planta and
 * the memorial descritivo, and it was never set at all — every document a
 * student produced came out signed "Surveyor Valley". A generated name means
 * the field is never empty, and the player can overwrite it with their own.
 */
const FIRST_NAMES = {
  m: [
    'Ayrton', 'Romário', 'Rivaldo', 'Cafu', 'Emerson', 'Nélson', 'Gustavo',
    'Oscar', 'Éder', 'Dunga', 'Djalma', 'Zico', 'Falcão', 'Serginho',
  ],
  f: [
    'Marta', 'Rayssa', 'Hortência', 'Daiane', 'Fabiana', 'Adriana', 'Maurine',
    'Formiga', 'Bia', 'Jaqueline', 'Sheilla', 'Joanna', 'Ketleyn', 'Rosamaria',
  ],
};

const SURNAMES = [
  'Senna', 'Fittipaldi', 'Piquet', 'Kuerten', 'Massa', 'Barrichello',
  'Marcari', 'Guimarães', 'dos Santos', 'Nascimento', 'Bueno', 'Sobral',
  'Cielo', 'Menezes', 'Peçanha', 'Vieira',
];

/**
 * @param {object} rng   any seeded stream, or `makeRng` of the moment
 * @param {'m'|'f'} body which pool of first names to draw from
 */
export function randomSurveyorName(rng, body = 'm') {
  const firsts = FIRST_NAMES[body] || FIRST_NAMES.m;
  return `${rng.pick(firsts)} ${rng.pick(SURNAMES)}`;
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
