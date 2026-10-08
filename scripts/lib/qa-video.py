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
import json
import re
import shutil
import subprocess
import sys

import video_metrics as metrics

FPS_MUESTREO = 10


def ffmpeg(args):
    return metrics.run_ffmpeg(args)


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
    return metrics.intervals(tiempos, paso, minimo)


def congelados(ruta, umbral):
    return metrics.frozen_spans(ruta, umbral)


def negros(ruta):
    return metrics.black_spans(ruta)


def audio(ruta):
    return metrics.qa_audio_legacy(ruta)


def rango(a, b):
    return f"{a:.1f}–{b:.1f} s ({b - a:.1f} s)"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--lufs", type=float, default=-14.0, help="sonoridad objetivo (por defecto -14, redes)")
    ap.add_argument("--congelado", type=float, default=0.35, help="umbral de diferencia de luma (0.35)")
    ap.add_argument("--max-congelado", type=float, default=0.6, help="máximo de segundos quietos seguidos antes de avisar (0.6)")
    ap.add_argument("--estricto", action="store_true", help="código de salida 1 si hay avisos")
    ap.add_argument("--json", action="store_true", help="emit a machine-readable JSON report")
    a = ap.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        sys.exit("Falta ffmpeg/ffprobe")
    dur, tiene_audio, wh = sonda(a.video)
    avisos = 0
    if not a.json:
        print(f"{a.video} · {dur:.1f} s · {'x'.join(wh[:2])} · {'con audio' if tiene_audio else 'sin audio'}\n")

    warnings = []
    image_report = {}
    if not a.json:
        print("IMAGEN")
    quietos, _ = congelados(a.video, a.congelado)
    total = sum(b - a_ for a_, b in quietos)
    largos = [(i, f) for i, f in quietos if f - i > a.max_congelado + 1e-9]
    image_report = {
        "frozenThreshold": a.congelado,
        "frozenSeconds": round(total, 3),
        "frozenSpans": [{"startSeconds": round(i, 3), "endSeconds": round(f, 3)} for i, f in quietos],
        "longFrozenSpans": [{"startSeconds": round(i, 3), "endSeconds": round(f, 3)} for i, f in largos],
    }
    if not a.json:
        print(f"  · quieto (diferencia < {a.congelado}): {total:.1f} s de {dur:.1f} s en {len(quietos)} tramos")
        for i, f in quietos:
            marca = "⚠" if (i, f) in largos else " "
            print(f"    {marca} {rango(i, f)}")
    if largos:
        avisos += 1
        warnings.append("Long frozen spans need a frame review.")
        if not a.json:
            print(f"  ⚠ {len(largos)} tramo(s) más largos que {a.max_congelado} s: mira si es una lectura intencional "
                  "o falta movimiento (un empuje lento del 3–5 % basta para mantenerlo vivo)")
    neg = negros(a.video)
    image_report["blackSpans"] = [{"startSeconds": round(i, 3), "endSeconds": round(f, 3)} for i, f in neg]
    if neg:
        if not a.json:
            print(f"  ℹ fotogramas negros: {', '.join(rango(i, f) for i, f in neg)}")
    else:
        if not a.json:
            print("  ✓ sin tramos negros")

    if not a.json:
        print("\nAUDIO")
    if not tiene_audio:
        if not a.json:
            print("  ℹ sin pista de audio")
        audio_report = None
    else:
        m = audio(a.video)
        ok_lufs = m["I"] is not None and abs(m["I"] - a.lufs) <= 1.5
        if not a.json:
            print(f"  {'✓' if ok_lufs else '⚠'} integrada {m['I']} LUFS (objetivo {a.lufs} ± 1.5)")
        avisos += 0 if ok_lufs else 1
        ok_tp = m["TP"] is not None and m["TP"] <= -1.0
        if not a.json:
            print(f"  {'✓' if ok_tp else '⚠'} pico real {m['TP']} dBFS (máximo −1.0)")
        avisos += 0 if ok_tp else 1
        plana = m["LRA"] is not None and m["LRA"] < 1.0
        if not a.json:
            print(f"  {'ℹ' if plana else '✓'} rango {m['LRA']} LU" + (" · mezcla plana: sin dinámica entre escenas (puede ser intencional)" if plana else ""))
        if m["cortos"]:
            vs = list(m["cortos"].values())
            if not a.json:
                print(f"  ℹ corto plazo por segundo: mín {min(vs):.1f} · máx {max(vs):.1f} LUFS")
        if m["silencios"]:
            warnings.append("Long audio silences need a listening review.")
            if not a.json:
                print(f"  ⚠ silencios (< −50 dB, ≥ 0.5 s): {', '.join(rango(i, f) for i, f in m['silencios'])}")
            avisos += 1
        else:
            if not a.json:
                print("  ✓ sin silencios largos")
        audio_report = {
            "integratedLufs": m["I"],
            "loudnessRangeLu": m["LRA"],
            "truePeakDbfs": m["TP"],
            "loudnessBySecond": {str(k): round(v, 3) for k, v in m["cortos"].items()},
            "silences": [{"startSeconds": round(i, 3), "endSeconds": round(f, 3)} for i, f in m["silencios"]],
            "checks": {"loudnessWithinTarget": ok_lufs, "truePeakAtOrBelowMinus1Dbfs": ok_tp},
        }

    if a.json:
        print(json.dumps({
            "schemaVersion": 1,
            "video": {"path": a.video, "durationSeconds": round(dur, 3), "width": wh[0], "height": wh[1], "hasAudio": tiene_audio},
            "image": image_report,
            "audio": audio_report,
            "warningCount": avisos,
            "warnings": warnings,
        }, ensure_ascii=False, sort_keys=True))
    else:
        print(f"\n{'Sin avisos' if not avisos else f'{avisos} aviso(s)'}. Son medidas, no gusto: escucha y mira los momentos señalados.")
    return 1 if (avisos and a.estricto) else 0


if __name__ == "__main__":
    sys.exit(main())
