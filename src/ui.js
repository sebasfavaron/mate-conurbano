// DOM text: speech bubbles, status line, tutorial, rules, score corner and the end screen (spec §5).
import { T } from './tuning.js';
import { LINES, RULES, LESSONS, pickLine } from './lines.js';
import { makeRng } from './rng.js';

const CW = 360, CH = 280;

export function bubblePosition(sx, sy, rect, w = CW, h = CH) {
  return { left: rect.left + sx * rect.width / w, top: rect.top + sy * rect.height / h };
}

export const pts = n => Math.round(n).toLocaleString('es-AR');

export function formatEnd(over, best) {
  return [
    `${pts(over.points ?? 0)} puntos`,
    `${over.score} ${over.score === 1 ? 'mate' : 'mates'} · la yerba aguantó ${over.minutes} min`,
    { gracias: 'le cebaste al que dijo gracias', seco: 'se cansaron de los mates secos' }[over.reason] || 'se lavó',
    `récord: ${pts(best)}`,
    'otra ronda',
  ];
}

// What the popup over the gourd says after each hand-off.
const RATING = {
  perfecto: ['¡Perfecto!', 'great'], 'muy bien': ['¡Muy bien!', 'great'], bien: ['Bien', 'ok'], zafa: ['Zafa', 'ok'],
  sacado: ['¡Te lo sacaron!', 'bad'], corto: ['¡Te lo sacaron! · corto', 'bad'], seco: ['¡Te lo sacaron! · seco', 'bad'],
};
export function popupText(handoff) {
  const [title, kind] = RATING[handoff.rating] || ['', 'ok'];
  const detail = [handoff.points > 0 ? `+${pts(handoff.points)}` : '+0', ...(handoff.tags || [])].join(' · ');
  return { title, detail, kind };
}

// One line on the end screen that says what to do differently next run.
export function endHint(over, stats) {
  if (over.reason === 'gracias') return 'acordate de quién dijo gracias';
  if (over.reason === 'seco') return 'cebá aunque sea a medias: tres mates secos seguidos y se van';
  if (stats.washSpill > stats.washTop) return `se rebalsó ${stats.spills === 1 ? 'una vez' : `${stats.spills} veces`}: soltá cuando aparece la espuma`;
  return 'el chorro lavó la montañita: inclinalo menos, que caiga al costado';
}

export function canRestart(sinceOver, pressedEdge) {
  return sinceOver >= T.RESTART_GUARD && pressedEdge;
}

export function createUi({ store, audio, canvas, headScreen, rigAnchor, onRestart }) {
  const $ = id => document.getElementById(id);
  const layer = $('bubbles'), status = $('status'), total = $('total'), matesEl = $('mates'), bestEl = $('best'), end = $('end');
  let shownPoints = 0;
  const rng = makeRng(Date.now() >>> 0);
  const lastLine = {};
  let bubbles = [], clock = 0, tutorialPourShown = false, teased = false;

  const setStatus = text => { if (status.textContent !== text) status.textContent = text; };
  const showBest = () => { const b = store.get('bestPoints', 0); bestEl.textContent = b ? `récord ${pts(b)}` : ''; };

  function say(seat, category, state, text) {
    const warn = category === 'gracias';
    if (seat == null || seat === 0 || !state.seats[seat]) return;
    const line = text || pickLine(category, rng, lastLine[category]);
    lastLine[category] = line;
    const occupant = state.seats[seat];
    const voice = occupant.look === 5 ? T.DRIVER_VOICE : T.FRIEND_VOICES[occupant.look] || T.FRIEND_VOICES[0];
    const silent = state.truck.active && seat !== 6; // the loudspeaker drowns every voice but the driver's
    const times = audio.say(line, voice, { silent });
    bubbles = bubbles.filter(b => { if (b.seat === seat) { b.el.remove(); return false; } return true; });
    const el = document.createElement('div');
    el.className = warn ? 'bubble warn' : 'bubble';
    layer.append(el);
    const until = clock + Math.max(T.BUBBLE_TIME, (times.at(-1) || 0) + .9);
    bubbles.push({ seat, el, line, times, start: clock, until });
    setStatus(line);
  }

  // lessons: the first time each thing happens on this device, a card in the middle explains it
  const lessonEl = $('lesson'), learned = store.get('learned', {}), lessons = [];
  let lessonOn = null;
  function teach(id) {
    if (learned[id] || lessons.includes(id) || lessonOn === id) return;
    lessons.push(id);
  }

  // the hand-off popup, floating up from the gourd
  function popup(handoff) {
    const { title, detail, kind } = popupText(handoff);
    for (const old of layer.querySelectorAll('.pop')) old.remove();
    const el = document.createElement('div');
    el.className = `pop ${kind}`;
    el.innerHTML = `<b>${title}</b><span>${detail}</span>`;
    const a = rigAnchor(), pos = bubblePosition(a.sx, a.sy, canvas.getBoundingClientRect());
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    layer.append(el);
    setTimeout(() => el.remove(), 2200);
  }

  // rules dialog
  const rules = $('rules');
  rules.querySelector('ol').innerHTML = RULES.map(r => `<li>${r}</li>`).join('');
  $('rules-open').addEventListener('click', () => { rules.showModal?.(); });
  $('relearn').addEventListener('click', () => {
    for (const k of Object.keys(learned)) delete learned[k];
    store.set('learned', {});
    $('relearn').textContent = 'listo: vuelven a aparecer';
  });

  // mute
  const mute = $('mute');
  const showMute = () => { mute.textContent = audio.muted ? 'sonido: no' : 'sonido: sí'; mute.setAttribute('aria-pressed', String(audio.muted)); };
  mute.addEventListener('click', () => { audio.setMuted(!audio.muted); store.set('muted', audio.muted); showMute(); canvas.focus({ preventScroll: true }); });
  showMute();
  showBest();

  // now-playing card: fades in slowly with each song and out a few seconds before it ends
  const np = $('nowplaying');
  return {
    intro() { setStatus(LINES.tutorial.start); teach('start'); },

    teach,
    get lessonPending() { return lessons.length > 0; },
    get lesson() { return lessonOn; },
    showLesson() {
      lessonOn = lessons.shift();
      learned[lessonOn] = true;
      store.set('learned', learned);
      const [title, body] = LESSONS[lessonOn];
      lessonEl.innerHTML = `<div><b>${title}</b><p>${body}</p><small>tocá, hacé clic o apretá espacio para seguir</small></div>`;
      lessonEl.hidden = false;
      return lessonOn;
    },
    hideLesson() { lessonEl.hidden = true; lessonOn = null; },

    nowPlaying(track, phase) {
      if (phase === 'ending') { np.classList.remove('on'); return; }
      np.innerHTML = `♪ <b>${track.title}</b><br>${track.artist} · versión lofi`;
      np.classList.remove('on');
      requestAnimationFrame(() => requestAnimationFrame(() => np.classList.add('on')));
    },

    setStatus,

    handle(events, state) {
      for (const e of events) {
        switch (e.type) {
          case 'pourStart':
            teach('gauge');
            if (state.tutorial && !tutorialPourShown) { tutorialPourShown = true; setStatus(LINES.tutorial.pouring); }
            break;
          case 'tutorialDone': setStatus(LINES.tutorial.first); teach('ronda'); break;
          case 'turn': teased = false; break;
          case 'tease': if (!teased) { teased = true; say(e.seat, 'impatient', state); } teach('tease'); break;
          case 'spill': say(e.seat, 'spill', state); teach('spill'); break;
          case 'lavado': say(e.seat, 'lavado', state); break;
          case 'arrive': say(e.seat, 'arrive', state); break;
          case 'handoff':
            if (!state.tutorial && e.seat !== 0) { popup(e); teach(e.grabbed ? 'grab' : 'points'); }
            // an empty grab always gets its own line; a half-full one only if nobody teased this turn
            if (e.grabbed && state.turn.fill < .02) say(e.seat, 'grabEmpty', state);
            else if (e.grabbed && !e.good && !teased) say(e.seat, 'grab', state);
            break;
          case 'skip': say(e.seat, 'skip', state); break;
          case 'guestArrive': say(6, 'guestAsk', state); break;
          case 'guestSignal': teach('guest'); break;
          case 'truckEnter': teach('truck'); break;
          case 'gracias':
            if (e.seat === 6) { say(6, 'guestThanks', state); break; }
            if (!e.palmOnly) say(e.seat, 'gracias', state);
            teach('gracias');
            if (!store.get('seenGracias', false)) { store.set('seenGracias', true); setStatus(LINES.tutorial.gracias); }
            break;
          case 'tip': setStatus(e.name === 'shift' ? LINES.tutorial.shiftTip : LINES.tutorial[e.name]); if (e.name === 'aim') teach('wash'); break;
          case 'gameOver': {
            if (e.reason === 'gracias') say(e.seat, 'bomb', state);
            const best = Math.max(store.get('bestPoints', 0), e.points);
            store.set('bestPoints', best);
            store.set('best', Math.max(store.get('best', 0), e.score));
            showBest();
            const lines = formatEnd(e, best);
            lines.splice(3, 0, endHint(e, state.stats));
            if (e.points >= best && e.points > 0) lines[4] = '¡récord nuevo!';
            end.firstElementChild.innerHTML = lines.slice(0, 5).map((l, i) => `<p class="${i ? 'muted' : ''}">${l}</p>`).join('')
              + `<button type="button" id="again">${lines[5]}</button>`;
            end.querySelector('#again').addEventListener('click', () => onRestart?.(true));
            end.hidden = false;
            break;
          }
        }
      }
      if (state.points !== shownPoints) {
        shownPoints = state.points;
        total.textContent = pts(state.points);
        total.classList.remove('bump'); void total.offsetWidth; total.classList.add('bump');
      }
      matesEl.textContent = `${state.score} ${state.score === 1 ? 'mate' : 'mates'}`;
    },

    frame(state, dt) {
      clock += dt;
      if (state.phase === 'pour' && state.turn.fill >= T.FILL_OK && !state.turn.trap) teach('foam');
      const rect = canvas.getBoundingClientRect();
      bubbles = bubbles.filter(b => {
        if (clock > b.until || !state.seats[b.seat]) { b.el.remove(); return false; }
        const since = clock - b.start, n = b.times.filter(t => t <= since).length;
        const text = b.line.slice(0, Math.max(1, n));
        if (b.el.textContent !== text) b.el.textContent = text;
        return true;
      });
      // place bubbles above their heads; a later one that would overlap an earlier one moves up
      const placed = [];
      for (const b of bubbles) {
        const head = headScreen(b.seat, state), pos = bubblePosition(head.sx, head.sy, rect);
        const w = b.el.offsetWidth, h = b.el.offsetHeight + 4;
        let top = pos.top;
        for (const o of placed) {
          if (Math.abs(o.left - pos.left) < (o.w + w) / 2 && top > o.top - h && top < o.top + o.h) top = o.top - h;
        }
        placed.push({ left: pos.left, top, w, h });
        b.el.style.left = pos.left + 'px';
        b.el.style.top = top + 'px';
      }
    },

    reset() {
      for (const b of bubbles) b.el.remove();
      bubbles = [];
      end.hidden = true;
      total.textContent = '0'; shownPoints = 0; matesEl.textContent = '0 mates';
      setStatus('');
    },
  };
}
