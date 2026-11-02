// Line bank (spec §5.2). Add lines freely; pickLine never repeats the previous one in a category.
import { nextRandom } from './rng.js';

export const LINES = {
  impatient: [
    '¿Es cuadrado ese mate que no gira?',
    'Tengo la garganta un poco seca…',
    'Che, no es cadena nacional',
    '¿Lo estás cebando o lo estás bendiciendo?',
    'Mientras tanto me tomo un tereré',
  ],
  spill: ['¡Ey, me mojaste el pantalón!', 'Tranqui que no es el Niágara'],
  lavado: ['¿Armamos otro así gira más rápido?', 'Este ya está para regar las plantas', 'Tiene gusto a agua de florero'],
  arrive: ['¿Hay lugar para uno más?', 'Traje bizcochitos, eh'],
  gracias: ['Gracias', 'Gracias, estoy bien', 'Ya estoy, gracias'],
  bomb: ['Te dije gracias, ¿eh?', '¿No escuchás o qué?'],
  grabEmpty: ['Che, ¡está seco!', '¿Y el agua, maestro?', '¿Mate de yerba sola? Innovador'],
  grab: ['Dame que se enfría', 'Así nomás, traé', '¿Medio mate? Bueno, peor es nada'],
  skip: ['Ya estoy, pasalo', 'No, pasá nomás'],
  guestAsk: ['Una mano, maestro, ¿me convidás uno?'],
  guestThanks: ['Gracias, jefe'],
  tutorial: {
    start: 'Mantené espacio, tocá y arrastrá hacia abajo, o apretá el gatillo para cebar',
    pouring: 'Despacio cae al costado. Si inclinás mucho, mojás la montañita',
    first: 'El primero es del cebador',
    gracias: 'Dijo gracias: ya no le cebes más. Dejá pasar el mate',
    shiftTip: 'Tip: con Shift apretado inclinás más despacio',
  },
};

export const RULES = [
  'Mantené para inclinar el termo y soltá cuando el mate esté lleno.',
  'Despacio cae al costado; si mojás la montañita, la yerba se lava. Si se lava toda, se termina.',
  'Si alguien dice gracias, no le cebes más: dejá pasar el mate. Si le cebás, perdiste.',
  'Cuando pasa el camión no se escucha nada: mirá las manos.',
];

export function pickLine(category, rng, last) {
  const pool = LINES[category];
  if (pool.length < 2) return pool[0];
  const options = pool.filter(line => line !== last);
  return options[Math.floor(nextRandom(rng) * options.length)];
}
