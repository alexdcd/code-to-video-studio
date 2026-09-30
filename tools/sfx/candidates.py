#!/usr/bin/env python3
"""Ordena grabaciones de efectos antes de escucharlas: duración activa, ataque, brillo y reparto de energía.

Uso: npm run sfx -- candidatos <audio> [<audio> ...]

Rechazos orientativos (se ajustan con las opciones; salen de la experiencia con whooshes repetidos bajo música suave):
  · retumbo: más del 50 % de la energía por debajo de 150 Hz → suena a «boom» cada vez que se repite;
  · siseo/clic: más del 40 % por encima de 6 kHz → cansa, sobre todo en efectos de interfaz;
  · largo: más de 0,8 s → un whoosh de transición que dure más pisa el siguiente plano.
Tampoco sustituye a escuchar: descarta lo claramente malo para no perder tiempo con ello.

Adaptado de sfx-candidates.py de echris6/motion-video-kit (MIT); ver docs/upstream/motion-video-kit.md.
"""
import argparse
import subprocess
import sys

try:
    import numpy as np
except ModuleNotFoundError:
    raise SystemExit("Missing optional dependency: numpy. Install numpy in the active Python environment before running this tool.")

SR = 44100


def cargar(ruta):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", ruta, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.float32)


def analizar(ruta):
    y = cargar(ruta)
    if not len(y):
        return None
    env = np.sqrt(np.convolve(y ** 2, np.ones(441) / 441, "same"))
    pico = env.max()
    activo = np.where(env > pico * .05)[0]
    dur = (activo[-1] - activo[0]) / SR
    ataque = (np.argmax(env) - activo[0]) / SR * 1000
    F = np.abs(np.fft.rfft(y)) ** 2
    fr = np.fft.rfftfreq(len(y), 1 / SR)
    tot = F.sum()
    centroide = float((F * fr).sum() / tot)
    return {"dur": dur, "ataque": ataque, "centroide": centroide,
            "graves": float(F[fr < 150].sum() / tot), "agudos": float(F[fr > 6000].sum() / tot)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audios", nargs="+")
    ap.add_argument("--max-graves", type=float, default=.5)
    ap.add_argument("--max-agudos", type=float, default=.4)
    ap.add_argument("--max-duracion", type=float, default=.8)
    a = ap.parse_args()
    malos = 0
    for ruta in a.audios:
        m = analizar(ruta)
        if m is None:
            print(f"{ruta}: no se puede leer")
            malos += 1
            continue
        motivos = [t for t, mal in (("retumbo", m["graves"] > a.max_graves), ("siseo/clic", m["agudos"] > a.max_agudos),
                                    ("largo", m["dur"] > a.max_duracion)) if mal]
        malos += bool(motivos)
        veredicto = "DESCARTAR: " + ", ".join(motivos) if motivos else "ok"
        print(f"{ruta}: {m['dur']:.2f} s · ataque {m['ataque']:.0f} ms · centroide {m['centroide']:.0f} Hz · "
              f"<150 Hz {m['graves'] * 100:.0f}% · >6 kHz {m['agudos'] * 100:.0f}% → {veredicto}")
    return 1 if malos == len(a.audios) else 0


if __name__ == "__main__":
    sys.exit(main())
