#!/usr/bin/env bash
# Suaviza una grabación de efecto: paso alto (quita retumbo), paso bajo (quita siseo) y fundidos sin clic.
# Uso: suavizar.sh <entrada> <salida.wav> [paso_alto=150] [paso_bajo=9500] [fundido_salida=0.15]
set -euo pipefail
in="${1:?Uso: suavizar.sh <entrada> <salida.wav> [paso_alto] [paso_bajo] [fundido_salida]}"; out="${2:?Falta la salida}"
hp="${3:-150}"; lp="${4:-9500}"; fd="${5:-0.15}"
dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")"
fs="$(python3 -c "print(max(0, $dur - $fd))")"
ffmpeg -loglevel error -y -i "$in" -af "highpass=f=$hp,lowpass=f=$lp,afade=t=in:d=0.005,afade=t=out:st=$fs:d=$fd" -ar 48000 "$out"
echo "$out"
