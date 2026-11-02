// DOM text: speech bubbles, status line, tutorial, rules, score corner and the end screen (spec §5).
import { T } from './tuning.js';
import { LINES, RULES, pickLine } from './lines.js';
import { makeRng } from './rng.js';

const CW = 360, CH = 280;

export function bubblePosition(sx, sy, rect, w = CW, h = CH) {
  return { left: rect.left + sx * rect.width / w, top: rect.top + sy * rect.height / h };
}

export function formatEnd(over, best) {
  return [
    `${over.score} ${over.score === 1 ? 'mate' : 'mates'}`,
    `la yerba aguantó ${over.minutes} min`,
    over.reason === 'gracias' ? 'le cebaste al que dijo gracias' : 'se lavó',
    `récord: ${best}`,
    'otra ronda',
  ];
}

export function canRestart(sinceOver, pressedEdge) {
  return sinceOver >= T.RESTART_GUARD && pressedEdge;
}

export function createUi({ store, audio, canvas, headScreen, onRestart }) {
  const $ = id => document.getElementById(id);
  const layer = $('bubbles'), status = $('status'), total = $('total'), bestEl = $('best'), end = $('end');
  const rng = makeRng(Date.now() >>> 0);
  const lastLine = {};
  let bubbles = [], clock = 0, tutorialPourShown = false;

  const setStatus = text => { if (status.textContent !== text) status.textContent = text; };
  const showBest = () => { const b = store.get('best', 0); bestEl.textContent = b ? ` récord ${b}` : ''; };

  function say(seat, category, state, text) {
    if (seat == null || seat === 0 || !state.seats[seat]) return;
    const line = text || pickLine(category, rng, lastLine[category]);
    lastLine[category] = line;
    const occupant = state.seats[seat];
    const voice = occupant.look === 5 ? T.DRIVER_VOICE : T.FRIEND_VOICES[occupant.look] || T.FRIEND_VOICES[0];
    const silent = state.truck.active && seat !== 6; // the loudspeaker drowns every voice but the driver's
    const times = audio.say(line, voice, { silent });
    bubbles = bubbles.filter(b => { if (b.seat === seat) { b.el.remove(); return false; } return true; });
    const el = document.createElement('div');
    el.className = 'bubble';
    layer.append(el);
    const until = clock + Math.max(T.BUBBLE_TIME, (times.at(-1) || 0) + .9);
    bubbles.push({ seat, el, line, times, start: clock, until });
    setStatus(line);
  }

  // rules dialog
  const rules = $('rules');
  rules.querySelector('ol').innerHTML = RULES.map(r => `<li>${r}</li>`).join('');
  $('rules-open').addEventListener('click', () => { rules.showModal?.(); });

  // mute
  const mute = $('mute');
  const showMute = () => { mute.textContent = audio.muted ? 'sonido: no' : 'sonido: sí'; mute.setAttribute('aria-pressed', String(audio.muted)); };
  mute.addEventListener('click', () => { audio.setMuted(!audio.muted); store.set('muted', audio.muted); showMute(); canvas.focus({ preventScroll: true }); });
  showMute();
  showBest();

  return {
    intro() { setStatus(LINES.tutorial.start); },

    handle(events, state) {
      for (const e of events) {
        switch (e.type) {
          case 'pourStart':
            if (state.tutorial && !tutorialPourShown) { tutorialPourShown = true; setStatus(LINES.tutorial.pouring); }
            break;
          case 'tutorialDone': setStatus(LINES.tutorial.first); break;
          case 'tease': say(e.seat, 'impatient', state); break;
          case 'spill': say(e.seat, 'spill', state); break;
          case 'lavado': say(e.seat, 'lavado', state); break;
          case 'arrive': say(e.seat, 'arrive', state); break;
          case 'guestArrive': say(6, 'guestAsk', state); break;
          case 'gracias':
            if (e.seat === 6) { say(6, 'guestThanks', state); break; }
            if (!e.palmOnly) say(e.seat, 'gracias', state);
            if (!store.get('seenGracias', false)) { store.set('seenGracias', true); setStatus(LINES.tutorial.gracias); }
            break;
          case 'tip': if (e.name === 'shift') setStatus(LINES.tutorial.shiftTip); break;
          case 'gameOver': {
            if (e.reason === 'gracias') say(e.seat, 'bomb', state);
            const best = Math.max(store.get('best', 0), e.score);
            store.set('best', best);
            showBest();
            const lines = formatEnd(e, best);
            end.firstElementChild.innerHTML = lines.slice(0, 4).map((l, i) => `<p class="${i ? 'muted' : ''}">${l}</p>`).join('')
              + `<button type="button" id="again">${lines[4]}</button>`;
            end.querySelector('#again').addEventListener('click', () => onRestart?.(true));
            end.hidden = false;
            break;
          }
        }
      }
      total.textContent = state.score;
    },

    frame(state, dt) {
      clock += dt;
      const rect = canvas.getBoundingClientRect();
      bubbles = bubbles.filter(b => {
        if (clock > b.until || !state.seats[b.seat]) { b.el.remove(); return false; }
        const head = headScreen(b.seat, state), pos = bubblePosition(head.sx, head.sy, rect);
        b.el.style.left = pos.left + 'px';
        b.el.style.top = pos.top + 'px';
        const since = clock - b.start, n = b.times.filter(t => t <= since).length;
        const text = b.line.slice(0, Math.max(1, n));
        if (b.el.textContent !== text) b.el.textContent = text;
        return true;
      });
    },

    reset() {
      for (const b of bubbles) b.el.remove();
      bubbles = [];
      end.hidden = true;
      total.textContent = '0';
      setStatus('');
    },
  };
}
