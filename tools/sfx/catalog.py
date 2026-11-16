#!/usr/bin/env python3
"""Catálogo local de SFX: registra, encuentra y prepara grabaciones sin cambiar el motor de mezcla."""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLED = ROOT / "kit" / "sfx"
PERSONAL = Path.home() / ".code-to-video-studio" / "sfx"  # local, outside the repository
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FORMATS = {".wav": "wav", ".ogg": "ogg", ".flac": "flac", ".mp3": "mp3"}
LICENSES = {"own", "cc0", "cc-by", "pixabay", "licensed"}
NON_REDISTRIBUTABLE = {"pixabay", "licensed"}


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as fd:
        for piece in iter(lambda: fd.read(1024 * 1024), b""):
            h.update(piece)
    return h.hexdigest()


def read_catalog(base):
    p = base / "catalogo.json"
    if base.is_symlink() or p.is_symlink():
        raise ValueError(f"No se permiten enlaces simbólicos al catálogo: {p}")
    if not p.exists():
        return {"version": 1, "sounds": []}
    data = json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("sounds"), list):
        raise ValueError(f"Catálogo inválido: {p}")
    return data


def safe_file(base, name):
    if not isinstance(name, str) or not name or Path(name).is_absolute() or ".." in Path(name).parts:
        raise ValueError("La ruta del sonido debe ser relativa al catálogo")
    root = base.resolve()
    path = base / name
    if not path.resolve().is_relative_to(root) or path.is_symlink():
        raise ValueError(f"Ruta fuera del catálogo o enlace simbólico: {name}")
    if path.suffix.lower() not in FORMATS:
        raise ValueError(f"Formato no admitido: {name} (WAV, OGG, FLAC o MP3)")
    return path


def all_sounds():
    results = {}
    for base in (BUNDLED, PERSONAL):
        for item in read_catalog(base)["sounds"]:
            if not isinstance(item, dict):
                raise ValueError(f"Entrada de catálogo inválida en {base}")
            ident = item.get("id")
            if not isinstance(ident, str) or not SLUG.fullmatch(ident):
                raise ValueError(f"ID inválido en {base}: {ident!r}")
            if ident in results:
                raise ValueError(f"ID duplicado en catálogos: {ident}")
            results[ident] = (base, item)
    return results


def validate_metadata(item, base):
    """Valida metadatos antes de escribir una grabación."""
    ident = item.get("id")
    if not isinstance(ident, str) or not SLUG.fullmatch(ident):
        raise ValueError(f"ID inválido: {ident!r}")
    for field in ("name", "family", "gesture", "source", "sha256"):
        if not isinstance(item.get(field), str) or not item[field].strip():
            raise ValueError(f"{ident}: falta {field}")
    if not SLUG.fullmatch(item["family"]):
        raise ValueError(f"{ident}: familia inválida")
    if not re.fullmatch(r"[0-9a-f]{64}", item["sha256"]):
        raise ValueError(f"{ident}: SHA-256 inválido")
    if item.get("energy") not in ("low", "medium", "high"):
        raise ValueError(f"{ident}: energy debe ser low, medium o high")
    for field in ("styles", "tags"):
        if not isinstance(item.get(field), list) or not all(isinstance(x, str) and x.strip() for x in item[field]):
            raise ValueError(f"{ident}: {field} debe ser lista de textos")
    if not isinstance(item.get("description", ""), str):
        raise ValueError(f"{ident}: description debe ser texto")
    if not isinstance(item.get("license"), str) or item["license"] not in LICENSES:
        raise ValueError(f"{ident}: licencia no admitida")
    if item["license"] == "cc-by" and (not isinstance(item.get("credit"), str) or not item["credit"].strip()):
        raise ValueError(f"{ident}: CC BY requiere atribución")
    if item["license"] in NON_REDISTRIBUTABLE:
        if base == BUNDLED:
            raise ValueError(f"{ident}: esta licencia no permite distribuir en el kit")
        if not isinstance(item.get("license_ref"), str) or not item["license_ref"].strip():
            raise ValueError(f"{ident}: falta referencia de licencia/contrato")
    duration = item.get("duration")
    if type(duration) not in (int, float) or not 0 < duration <= 120:
        raise ValueError(f"{ident}: duración inválida")
    safe_file(base, item.get("file"))
    return ident


def verify_one(base, item):
    ident = validate_metadata(item, base)
    p = safe_file(base, item["file"])
    if not p.is_file():
        raise ValueError(f"{ident}: no existe {p}")
    if digest(p) != item["sha256"]:
        raise ValueError(f"{ident}: SHA-256 incorrecto; se modificó el archivo")
    mixer_decode(p)
    return p



def mixer_decode(path):
    """Decodifica el fichero entero con SoundFile y muestras float32.

    FFprobe puede aceptar códecs (p. ej. Speex en OGG) que libsndfile no soporta.
    Lectura por bloques: detecta errores a mitad del archivo sin cargarlo entero.
    """
    try:
        import numpy as np
        import soundfile as sf
    except ImportError as exc:
        raise ValueError("La validación necesita numpy y soundfile: ejecuta pnpm run sfx:setup") from exc
    try:
        frames_read = 0
        with sf.SoundFile(str(path)) as fd:
            if fd.channels not in (1, 2) or fd.samplerate <= 0:
                raise ValueError("Solo se admite audio mono/estéreo a frecuencia positiva")
            while True:
                audio = fd.read(frames=65536, dtype="float32", always_2d=True)
                if audio.size == 0:
                    break
                if not np.isfinite(audio).all():
                    raise ValueError("Audio con valores no finitos")
                frames_read += len(audio)
        if frames_read == 0:
            raise ValueError("Audio sin muestras decodificables")
    except (OSError, RuntimeError, ValueError) as exc:
        raise ValueError(f"Audio incompatible con soundfile: {path}: {exc}") from exc


def audio_duration(path):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-protocol_whitelist", "file",
             "-f", FORMATS[path.suffix.lower()], "-select_streams", "a:0",
             "-show_entries", "stream=duration,channels:format=duration", "-of", "json", str(path.resolve())],
            check=True, capture_output=True, text=True, timeout=30,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"ffprobe no puede analizar {path}: {exc}") from exc
    data = json.loads(r.stdout)
    entries = data.get("streams", [])
    duration = next((float(x["duration"]) for x in entries if x.get("duration") not in (None, "N/A")), None)
    if duration is None and data.get("format", {}).get("duration"):
        duration = float(data["format"]["duration"])
    if not entries or duration is None or not 0 < duration <= 120:
        raise ValueError(f"Sin audio válido o duración fuera de 0-120 s: {path}")
    if entries[0].get("channels") not in (1, 2):
        raise ValueError(f"Se requiere audio mono o estéreo: {path}")
    mixer_decode(path)
    return duration


def comma(text):
    return [s.strip() for s in text.split(",") if s.strip()]


def copy_new(src, dst):
    with src.open("rb") as inp, dst.open("xb") as out:
        try:
            shutil.copyfileobj(inp, out)
        except OSError:
            dst.unlink(missing_ok=True)
            raise


def write_catalog(base, catalog):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=base, delete=False) as out:
        path = Path(out.name)
        try:
            json.dump(catalog, out, ensure_ascii=False, indent=2)
            out.write("\n")
            out.close()
            path.replace(base / "catalogo.json")
        finally:
            path.unlink(missing_ok=True)


def register(args):
    if not SLUG.fullmatch(args.id) or not SLUG.fullmatch(args.family):
        raise ValueError("ID y familia deben ser slugs minúsculos con guiones")
    src = Path(args.file).expanduser()
    if src.is_symlink() or not src.is_file() or src.suffix.lower() not in FORMATS:
        raise ValueError("El sonido debe ser un archivo WAV, OGG, FLAC o MP3 normal")
    if args.license == "cc-by" and not (args.credit or "").strip():
        raise ValueError("CC BY requiere --credit para publicar los créditos del vídeo")
    if args.license in NON_REDISTRIBUTABLE and not (args.license_ref or "").strip():
        raise ValueError("Pixabay/licensed requieren --license-ref verificable")
    duration = audio_duration(src)
    sha = digest(src)
    base = PERSONAL
    folder = base / "files"
    if base.is_symlink() or folder.is_symlink():
        raise ValueError("La biblioteca no puede contener enlaces simbólicos en su raíz")
    folder.mkdir(parents=True, exist_ok=True)
    name = f"files/{args.id}{src.suffix.lower()}"
    dst = safe_file(base, name)
    if dst.exists():
        raise ValueError(f"Ya existe el destino: {dst}")
    item = {
        "id": args.id, "name": args.name, "family": args.family,
        "gesture": args.gesture, "energy": args.energy,
        "styles": comma(args.styles), "tags": comma(args.tags),
        "file": name, "duration": duration, "sha256": sha,
        "license": args.license, "source": args.source,
        "description": args.description,
    }
    if args.license_ref:
        item["license_ref"] = args.license_ref.strip()
    if args.credit:
        item["credit"] = args.credit
    validate_metadata(item, base)
    lock = base / ".catalogo.lock"
    try:
        lock.mkdir()
    except FileExistsError as exc:
        raise ValueError("Hay otro registro en curso en el catálogo; vuelve a intentarlo") from exc
    try:
        if args.id in all_sounds():
            raise ValueError(f"ID ya registrado: {args.id}")
        catalog = read_catalog(base)
        catalog["sounds"].append(item)
        copy_new(src, dst)
        try:
            write_catalog(base, catalog)
        except OSError:
            dst.unlink(missing_ok=True)
            raise
    finally:
        lock.rmdir()
    print(f"Registrado: {args.id} ({duration:.2f}s) → {dst}")


def list_sounds(args):
    matches = []
    for ident, (base, item) in sorted(all_sounds().items()):
        if args.family and args.family != item.get("family"):
            continue
        if args.style and args.style not in item.get("styles", []) and "all" not in item.get("styles", []):
            continue
        if args.gesture and args.gesture not in item.get("gesture", ""):
            continue
        if args.energy and args.energy != item.get("energy"):
            continue
        if args.tag and args.tag not in item.get("tags", []):
            continue
        matches.append({"library": "kit" if base == BUNDLED else "personal", **item})
    if args.json:
        print(json.dumps(matches, ensure_ascii=False, indent=2))
        return
    for item in matches:
        print(f"{item['id']:28} {item.get('family','?'):12} {item.get('energy','?'):8} "
              f"{item.get('gesture','?')} · {item.get('name','?')} [{item['library']}]")
    if not matches:
        print("No hay sonidos catalogados con estos filtros.")


def check():
    found = all_sounds()
    for base, item in found.values():
        verify_one(base, item)
    print(f"Catálogo válido: {len(found)} sonidos.")
    return 0


def stage(args):
    project = Path(args.project).expanduser().resolve()
    if not project.is_dir():
        raise ValueError(f"El proyecto no existe: {project}")
    target = project / "assets" / "sfx"
    if (project / "assets").is_symlink() or not target.resolve().is_relative_to(project) or target.is_symlink():
        raise ValueError("El destino de SFX no debe ser un enlace simbólico")
    found = all_sounds()
    selected = []
    for ident in dict.fromkeys(args.ids):
        if ident not in found:
            raise ValueError(f"ID desconocido: {ident}")
        base, item = found[ident]
        path = verify_one(base, item)
        dst = target / f"{ident}{path.suffix.lower()}"
        if os.path.lexists(dst) and (dst.is_symlink() or not dst.is_file() or digest(dst) != item["sha256"]):
            raise ValueError(f"Destino ya existe con contenido distinto: {dst}")
        selected.append((item, path, dst))

    credits_path = target / "CREDITS.md"
    if os.path.lexists(credits_path) and (credits_path.is_symlink() or not credits_path.is_file()):
        raise ValueError(f"Créditos no editables: {credits_path}")
    existing = credits_path.read_text(encoding="utf-8") if credits_path.exists() else ""
    credits = []
    new_lines = []
    for item, _, _ in selected:
        if item["license"] != "cc-by":
            continue
        credits.append({"id": item["id"], "credit": item["credit"], "source": item["source"]})
        marker = f"<!-- catalogo-sfx:{item['id']} -->"
        if marker not in existing:
            safe_credit = " ".join(item["credit"].splitlines()).strip()
            safe_source = " ".join(item["source"].splitlines()).strip()
            new_lines.append(f"- {safe_credit} · Fuente: {safe_source} {marker}")

    target.mkdir(parents=True, exist_ok=True)
    pools = {}
    for item, path, dst in selected:
        if not os.path.lexists(dst):
            copy_new(path, dst)
        pools.setdefault(item["family"], []).append(f"assets/sfx/{dst.name}")

    if new_lines:
        heading = "# Créditos SFX\n\n" if not existing else ("" if existing.endswith("\n") else "\n")
        with credits_path.open("a", encoding="utf-8") as out:
            out.write(heading + "\n".join(new_lines) + "\n")
    print(json.dumps({"pools": pools, "credits_to_publish": credits}, ensure_ascii=False, indent=2))
    print("Los archivos están listos para tu línea de tiempo; no se modificó ninguna mezcla.", file=sys.stderr)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    a = sub.add_parser("add", help="Registrar una grabación propia/licenciada en la biblioteca personal")
    a.add_argument("file")
    for field in ("id", "name", "family", "gesture", "source"):
        a.add_argument("--" + field, required=True)
    a.add_argument("--energy", choices=("low", "medium", "high"), required=True)
    a.add_argument("--styles", default="all")
    a.add_argument("--tags", default="")
    a.add_argument("--license", choices=sorted(LICENSES), required=True)
    a.add_argument("--credit")
    a.add_argument("--license-ref", help="Enlace o contrato verificable para Pixabay/licensed")
    a.add_argument("--description", default="", help="Carácter sonoro, textura y momento apropiado")
    a.set_defaults(func=register)
    l = sub.add_parser("list", help="Buscar por familia y estilo")
    l.add_argument("--family")
    l.add_argument("--style")
    l.add_argument("--gesture")
    l.add_argument("--energy", choices=("low", "medium", "high"))
    l.add_argument("--tag")
    l.add_argument("--json", action="store_true", help="Lista estructurada para agentes")
    l.set_defaults(func=list_sounds)
    c = sub.add_parser("check", help="Verificar metadatos, rutas y SHA-256")
    c.set_defaults(func=lambda _: check())
    s = sub.add_parser("stage", help="Copiar sonidos elegidos a un proyecto y mostrar layers.pools")
    s.add_argument("--project", required=True)
    s.add_argument("ids", nargs="+")
    s.set_defaults(func=stage)
    args = p.parse_args(argv)
    try:
        args.func(args)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
