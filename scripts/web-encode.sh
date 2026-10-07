#!/usr/bin/env bash
# Create a quality-targeted web MP4 from a rendered master using x264 CRF.
# Usage: pnpm run web:encode <master.mp4> [CRF=20]
set -euo pipefail

die() { echo "Error: $*" >&2; exit 1; }

if [[ $# -lt 1 || $# -gt 2 ]]; then
  die "Uso: pnpm run web:encode <master.mp4> [CRF=20]"
fi

input="$1"
crf="${2:-20}"
[[ -f "$input" ]] || die "No encuentro el vídeo: $input"
[[ ! -L "$input" ]] || die "El vídeo de entrada no puede ser un symlink."
[[ "$input" == *.mp4 || "$input" == *.MP4 ]] || die "La entrada debe ser un MP4."
[[ "$crf" =~ ^[0-9]+$ ]] || die "CRF debe ser un entero entre 18 y 24."
(( crf >= 18 && crf <= 24 )) || die "CRF debe estar entre 18 y 24; un número menor conserva más detalle y pesa más."

input_dir="$(cd "$(dirname "$input")" && pwd)"
input="$input_dir/$(basename "$input")"
input_stem="${input%.*}"
output="${input_stem}-web.mp4"
temp_output="${input_stem}-web.tmp-$$.mp4"
[[ ! -e "$output" && ! -L "$output" ]] || die "Ya existe $output; no lo sobrescribo."
[[ ! -e "$temp_output" && ! -L "$temp_output" ]] || die "Ya existe el temporal $temp_output."

command -v ffmpeg >/dev/null 2>&1 || die "Falta ffmpeg."
command -v ffprobe >/dev/null 2>&1 || die "Falta ffprobe."

audio_codec="$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$input")"
audio_args=(-an)
if [[ -n "$audio_codec" ]]; then
  if [[ "$audio_codec" == aac ]]; then
    audio_args=(-c:a copy)
  else
    audio_args=(-c:a aac -b:a 192k)
  fi
fi

cleanup() {
  rm -f "$temp_output"
}
trap cleanup EXIT

echo "Codificando MP4 H.264 · libx264 veryslow · CRF ${crf} · calidad constante, tamaño adaptativo"
ffmpeg -hide_banner -loglevel error -n -i "$input" \
  -map 0:v:0 -map "0:a:0?" -c:v libx264 -preset veryslow -crf "$crf" \
  -pix_fmt yuv420p -profile:v high -movflags +faststart \
  "${audio_args[@]}" "$temp_output"

[[ ! -e "$output" && ! -L "$output" ]] || die "Apareció $output durante la codificación; no lo sobrescribo."
mv -n "$temp_output" "$output"
[[ -f "$output" && ! -e "$temp_output" ]] || die "No pude guardar la variante web sin sobrescribir."
echo "→ $output"
actual_bytes="$(wc -c < "$output")"
actual_mb="$(awk -v bytes="$actual_bytes" 'BEGIN { printf "%.2f", bytes/1000000 }')"
echo "Tamaño: ${actual_mb} MB · CRF ${crf}"
