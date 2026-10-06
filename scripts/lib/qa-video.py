#!/usr/bin/env python3
"""Control de calidad medible de un MP4 renderizado (solo ffmpeg + biblioteca estándar).

Uso: pnpm run qa <video.mp4> [--lufs -14] [--congelado 0.35] [--max-congelado 0.6] [--estricto]

Comprueba lo que un vistazo no ve y `hyperframes check` no mide en el render final:
  · tramos casi congelados (diferencia de luma entre fotogramas a 10 fps por debajo del umbral);
  · fotogramas negros;
  · sonoridad integrada, rango (LRA), pico real y la curva por segundo;
  · silencios dentro de la pista de audio.
Son heurísticas: un tramo congelado puede ser intencional (un título que se lee, el cierre). El informe
dice dónde mirar; no decide si está bien. Con --estricto sale con código 1 si hay avisos.

Adaptado de las ideas de frozen-time.sh / loudness.sh de echris6/motion-video-kit (MIT);
ver docs/upstream/motion-video-kit.md.
"""
import argparse
import re
import shutil
import subprocess
import sys

FPS_MUESTREO = 10


def ffmpeg(args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True)
    return r.stderr


def sonda(ruta):
    def q(entradas, flujo=None):
        cmd = ["ffprobe", "-v", "error"]
        if flujo:
            cmd += ["-select_streams", flujo]
        cmd += ["-show_entries", entradas, "-of", "csv=p=0", ruta]
        return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()
    dur = float(q("format=duration") or 0)
    tiene_audio = bool(q("stream=codec_type", "a:0"))
    wh = q("stream=width,height,r_frame_rate", "v:0").split(",")
    return dur, tiene_audio, wh


def intervalos(tiempos, paso, minimo):
    """Agrupa muestras consecutivas en (inicio, fin) y descarta las más cortas que `minimo` segundos."""
    grupos, ini, prev = [], None, None
    for t in tiempos:
        if ini is None:
            ini = prev = t
        elif t - prev <= paso * 1.01:
            prev = t
        else:
            grupos.append((ini, prev))
            ini = prev = t
    if ini is not None:
        grupos.append((ini, prev))
    return [(a, b + paso) for a, b in grupos if (b + paso - a) >= minimo - 1e-9]


def congelados(ruta, umbral):
    filtro = (f"fps={FPS_MUESTREO},scale=320:-1,format=gray,tblend=all_mode=difference,"
              "signalstats,metadata=print:key=lavfi.signalstats.YAVG")
    txt = ffmpeg(["-i", ruta, "-vf", filtro, "-an", "-f", "null", "-"])
    valores = [float(v) for v in re.findall(r"YAVG=([0-9.]+)", txt)]
    paso = 1 / FPS_MUESTREO
    # la primera muestra no tiene fotograma anterior con el que restar
    tiempos = [i * paso for i, v in enumerate(valores) if i > 0 and v < umbral]
    return intervalos(tiempos, paso, 2 * paso), len(valores) * paso


def negros(ruta):
    txt = ffmpeg(["-i", ruta, "-vf", "blackdetect=d=0.1:pix_th=0.10", "-an", "-f", "null", "-"])
    return [(float(a), float(b)) for a, b in re.findall(r"black_start:([0-9.]+) black_end:([0-9.]+)", txt)]


def audio(ruta):
    txt = ffmpeg(["-i", ruta, "-af", "ebur128=peak=true", "-vn", "-f", "null", "-"])
    resumen = txt[txt.rfind("Summary:"):]
    def num(patron):
        m = re.search(patron, resumen)
        return float(m.group(1)) if m else None
    cortos = {}
    for t, s in re.findall(r"t:\s*([0-9.]+)\s.*?S:\s*(-?[0-9.]+)", txt):
        seg = int(float(t))
        if float(s) > -70:
            cortos[seg] = float(s)
    sil = ffmpeg(["-i", ruta, "-af", "silencedetect=noise=-50dB:d=0.5", "-vn", "-f", "null", "-"])
    silencios = [(float(a), float(b)) for a, b in re.findall(r"silence_start: ([0-9.]+).*?silence_end: ([0-9.]+)", sil, re.S)]
    return {"I": num(r"I:\s+(-?[0-9.]+) LUFS"), "LRA": num(r"LRA:\s+([0-9.]+) LU"),
            "TP": num(r"Peak:\s+(-?[0-9.]+) dBFS"), "cortos": cortos, "silencios": silencios}


def rango(a, b):
    return f"{a:.1f}–{b:.1f} s ({b - a:.1f} s)"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--lufs", type=float, default=-14.0, help="sonoridad objetivo (por defecto -14, redes)")
    ap.add_argument("--congelado", type=float, default=0.35, help="umbral de diferencia de luma (0.35)")
    ap.add_argument("--max-congelado", type=float, default=0.6, help="máximo de segundos quietos seguidos antes de avisar (0.6)")
    ap.add_argument("--estricto", action="store_true", help="código de salida 1 si hay avisos")
    a = ap.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("Falta ffmpeg/ffprobe")
    dur, tiene_audio, wh = sonda(a.video)
    avisos = 0
    print(f"{a.video} · {dur:.1f} s · {'x'.join(wh[:2])} · {'con audio' if tiene_audio else 'sin audio'}\n")

    print("IMAGEN")
    quietos, _ = congelados(a.video, a.congelado)
    total = sum(b - a_ for a_, b in quietos)
    largos = [(i, f) for i, f in quietos if f - i > a.max_congelado + 1e-9]
    print(f"  · quieto (diferencia < {a.congelado}): {total:.1f} s de {dur:.1f} s en {len(quietos)} tramos")
    for i, f in quietos:
        marca = "⚠" if (i, f) in largos else " "
        print(f"    {marca} {rango(i, f)}")
    if largos:
        avisos += 1
        print(f"  ⚠ {len(largos)} tramo(s) más largos que {a.max_congelado} s: mira si es una lectura intencional "
              "o falta movimiento (un empuje lento del 3–5 % basta para mantenerlo vivo)")
    neg = negros(a.video)
    if neg:
        print(f"  ℹ fotogramas negros: {', '.join(rango(i, f) for i, f in neg)}")
    else:
        print("  ✓ sin tramos negros")

    print("\nAUDIO")
    if not tiene_audio:
        print("  ℹ sin pista de audio")
    else:
        m = audio(a.video)
        ok_lufs = m["I"] is not None and abs(m["I"] - a.lufs) <= 1.5
        print(f"  {'✓' if ok_lufs else '⚠'} integrada {m['I']} LUFS (objetivo {a.lufs} ± 1.5)")
        avisos += 0 if ok_lufs else 1
        ok_tp = m["TP"] is not None and m["TP"] <= -1.0
        print(f"  {'✓' if ok_tp else '⚠'} pico real {m['TP']} dBFS (máximo −1.0)")
        avisos += 0 if ok_tp else 1
        plana = m["LRA"] is not None and m["LRA"] < 1.0
        print(f"  {'ℹ' if plana else '✓'} rango {m['LRA']} LU" + (" · mezcla plana: sin dinámica entre escenas (puede ser intencional)" if plana else ""))
        if m["cortos"]:
            vs = list(m["cortos"].values())
            print(f"  ℹ corto plazo por segundo: mín {min(vs):.1f} · máx {max(vs):.1f} LUFS")
        if m["silencios"]:
            print(f"  ⚠ silencios (< −50 dB, ≥ 0.5 s): {', '.join(rango(i, f) for i, f in m['silencios'])}")
            avisos += 1
        else:
            print("  ✓ sin silencios largos")

    print(f"\n{'Sin avisos' if not avisos else f'{avisos} aviso(s)'}. Son medidas, no gusto: escucha y mira los momentos señalados.")
    return 1 if (avisos and a.estricto) else 0


if __name__ == "__main__":
    sys.exit(main())
