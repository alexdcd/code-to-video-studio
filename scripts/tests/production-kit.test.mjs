import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadKit() {
  const timelines = [];
  const gsap = {
    registerPlugin() {},
    timeline() {
      const timeline = {
        to(target, vars) {
          this.target = target;
          this.vars = vars;
          return this;
        },
      };
      timelines.push(timeline);
      return timeline;
    },
  };
  const context = vm.createContext({ window: {}, gsap, Math, console, Number, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "kit/lib/mafia.js"), "utf8"), context);
  return { MAFIA: context.window.MAFIA, timelines };
}

test("time maps interpolate, extrapolate and seek the original timeline deterministically", () => {
  const { MAFIA, timelines } = loadKit();
  const map = MAFIA.mapaTiempo([[0, 0], [10, 8], [20, 20]]);
  assert.equal(map.aNuevo(5), 4);
  assert.equal(map.aViejo(4), 5);
  assert.equal(map.aViejo(14), 15);
  assert.equal(map.aNuevo(24), 24);

  const seeks = [];
  const outer = map.envolver({ time(value) { seeks.push(value); } }, 8);
  assert.equal(outer, timelines.at(-1));
  assert.equal(outer.vars.duration, 8);
  outer.target.t = 4;
  outer.vars.onUpdate();
  assert.deepEqual(seeks, [5]);
});

test("time maps reject invalid or non-monotone anchors and durations", () => {
  const { MAFIA } = loadKit();
  assert.throws(() => MAFIA.mapaTiempo([[0, 0]]), /dos anclas/);
  assert.throws(() => MAFIA.mapaTiempo([[0, 0], [0, 1]]), /crecer estrictamente/);
  assert.throws(() => MAFIA.mapaTiempo([[0, 0], [2, 1], [1, 3]]), /crecer estrictamente/);
  assert.throws(() => MAFIA.mapaTiempo([[0, 0], [Number.NaN, 2]]), /inválida/);
  assert.throws(() => MAFIA.mapaTiempo([[0, 0], [2, 2]]).envolver({ time() {} }, 0), /positiva/);
});

test("subtitle helpers merge hide ranges and group timed words", () => {
  const { MAFIA } = loadKit();
  assert.deepEqual(JSON.parse(JSON.stringify(MAFIA.subs.tramos([[3, 5], [1, 3], [7, 8]]))), [[1, 5], [7, 8]]);
  const hidden = MAFIA.subs.oculto([[1, 3]]);
  assert.equal(hidden(2), true);
  assert.equal(hidden(3), false);
  assert.throws(() => MAFIA.subs.tramos([[3, 2]]), /tramo inválido/);

  const groups = MAFIA.subs.grupos({ lineas: [{
    inicio: 0,
    fin: 2,
    palabras: [
      { t: "One", i: 0.1 }, { t: "small", i: 0.3 },
      { t: "step", i: 0.6 }, { t: "forward", i: 1.0 },
    ],
  }] });
  assert.deepEqual(JSON.parse(JSON.stringify(groups.map(group => group.pal.map(word => word.t)))), [["One", "small", "step"], ["forward"]]);
});
