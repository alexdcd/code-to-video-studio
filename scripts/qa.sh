#!/usr/bin/env bash
# Control de calidad medible de un render: tramos quietos, negros, sonoridad, pico y silencios.
# Uso: npm run qa -- <video.mp4> [--lufs -14] [--congelado 0.35] [--max-congelado 0.6] [--estricto]
set -euo pipefail
v="${1:?Uso: qa.sh <video.mp4> [opciones]}"
[ -f "$v" ] || { echo "No existe $v" >&2; exit 1; }
exec python3 "$(dirname "$0")/lib/qa-video.py" "$@"
