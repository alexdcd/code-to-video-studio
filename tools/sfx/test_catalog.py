"""Regresiones del catálogo SFX: sin red, sin modificar el motor musical."""
import contextlib
import io
import json
import shutil
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest import mock

import catalog as catalogo


def wav(path):
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(48000)
        f.writeframes(b"\0\0" * 4800)


class Catalogo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.local = self.root / "recursos" / "sfx"
        self.bundle = self.root / "kit" / "sfx"
        self.bundle.mkdir(parents=True)
        (self.bundle / "catalogo.json").write_text('{"version":1,"sounds":[]}', encoding="utf-8")
        p1 = mock.patch.object(catalogo, "BUNDLED", self.bundle)
        p2 = mock.patch.object(catalogo, "PERSONAL", self.local)
        p1.start()
        p2.start()
        self.addCleanup(p1.stop)
        self.addCleanup(p2.stop)
        self.src = self.root / "original.wav"
        wav(self.src)

    def add(self, ident="clic-suave", license="own", credit=None, name=None, gesture=None, source=None, license_ref=None):
        argv = ["add", str(self.src), "--id", ident, "--name", "Click suave",
                "--family", "click", "--gesture", "pulsar-boton", "--energy", "low",
                "--styles", "editorial-motion", "--tags", "ui,discreto",
                "--license", license, "--source", "grabacion-propia"]
        if credit:
            argv += ["--credit", credit]
        if name is not None:
            argv += ["--name", name]
        if gesture is not None:
            argv += ["--gesture", gesture]
        if source is not None:
            argv += ["--source", source]
        if license_ref is not None:
            argv += ["--license-ref", license_ref]
        with mock.patch.object(catalogo, "audio_duration", return_value=0.1), contextlib.redirect_stdout(io.StringIO()):
            return catalogo.main(argv)

    def test_add_y_check_guarda_procedencia_y_huella(self):
        self.assertEqual(self.add(), 0)
        item = catalogo.read_catalog(self.local)["sounds"][0]
        self.assertEqual(item["sha256"], catalogo.digest(self.src))
        self.assertEqual(item["gesture"], "pulsar-boton")
        self.assertEqual(item["styles"], ["editorial-motion"])
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(catalogo.main(["check"]), 0)

    def test_stage_no_toca_plan_existente(self):
        self.add()
        project = self.root / "proyecto"
        project.mkdir()
        plan = project / "timeline.json"
        plan.write_text('{"layers":{"events":[]}}', encoding="utf-8")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(catalogo.main(["stage", "--project", str(project), "clic-suave"]), 0)
        data = json.loads(output.getvalue())
        self.assertEqual(data["pools"]["click"], ["assets/sfx/clic-suave.wav"])
        self.assertEqual(plan.read_text(encoding="utf-8"), '{"layers":{"events":[]}}')
        self.assertEqual(catalogo.digest(project / "assets/sfx/clic-suave.wav"), catalogo.digest(self.src))

    def test_no_se_sobrescribe_archivo_del_proyecto(self):
        self.add()
        project = self.root / "proyecto"
        dest = project / "assets" / "sfx"
        dest.mkdir(parents=True)
        (dest / "clic-suave.wav").write_bytes(b"otro sonido")
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(catalogo.main(["stage", "--project", str(project), "clic-suave"]), 1)
        self.assertEqual((dest / "clic-suave.wav").read_bytes(), b"otro sonido")

    def test_modificacion_de_audio_se_detecta_por_hash(self):
        self.add()
        (self.local / "files/clic-suave.wav").write_bytes(b"alterado")
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(catalogo.main(["check"]), 1)

    def test_no_permita_licencias_sin_atribucion(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.add(license="cc-by"), 1)
        self.assertEqual(self.add(license="cc-by", credit="Autor, CC BY 4.0, https://ejemplo.com"), 0)

    def test_id_repetido_rechazado(self):
        self.add()
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.add(), 1)

    def test_rechaza_rutas_fuera_de_la_biblioteca(self):
        with self.assertRaises(ValueError):
            catalogo.safe_file(self.local, "../otra.wav")


    def test_datos_vacios_no_crean_entradas(self):
        for field, val in (("name", ""), ("gesture", "  "), ("source", "")):
            with self.subTest(field=field), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(self.add(**{field: val}), 1)
                self.assertEqual(catalogo.read_catalog(self.local)["sounds"], [])
                self.assertFalse((self.local / "files/clic-suave.wav").exists())

    def test_licencias_personales_requieren_referencia(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.add(license="pixabay"), 1)
        self.assertEqual(self.add(license="licensed", license_ref="Contrato privado 2026-01"), 0)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(catalogo.main(["check"]), 0)

    def test_licencias_personales_prohibidas_en_kit(self):
        self.assertEqual(self.add(license="pixabay", license_ref="https://pixabay.com/service/license-summary/"), 0)
        item = catalogo.read_catalog(self.local)["sounds"][0]
        with self.assertRaisesRegex(ValueError, "kit"):
            catalogo.validate_metadata(item, self.bundle)

    def test_creditos_persistentes_e_idempotentes(self):
        self.assertEqual(self.add(license="cc-by", credit="Sonido de Ana · CC BY 4.0"), 0)
        project = self.root / "proyecto"
        target = project / "assets" / "sfx"
        target.mkdir(parents=True)
        credits = target / "CREDITS.md"
        credits.write_text("# Otras atribuciones\n\n- Fuente anterior\n", encoding="utf-8")
        cmd = ["stage", "--project", str(project), "clic-suave", "clic-suave"]
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(catalogo.main(cmd), 0)
        first = credits.read_text(encoding="utf-8")
        self.assertIn("Fuente anterior", first)
        self.assertIn("Sonido de Ana", first)
        self.assertEqual(first.count("catalogo-sfx:clic-suave"), 1)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(catalogo.main(cmd), 0)
        self.assertEqual(first, credits.read_text(encoding="utf-8"))

    def test_bloquea_symlinks_en_assets_y_destino_colgante(self):
        self.assertEqual(self.add(), 0)
        project = self.root / "proyecto"
        project.mkdir()
        outside = self.root / "outside"
        outside.mkdir()
        (project / "assets").symlink_to(outside, target_is_directory=True)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(catalogo.main(["stage", "--project", str(project), "clic-suave"]), 1)
        (project / "assets").unlink()
        (project / "assets/sfx").mkdir(parents=True)
        link = project / "assets/sfx/clic-suave.wav"
        link.symlink_to(self.root / "no-existe.wav")
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(catalogo.main(["stage", "--project", str(project), "clic-suave"]), 1)
        self.assertTrue(link.is_symlink())

    def test_bloquea_catalogo_symlink(self):
        self.local.mkdir(parents=True)
        (self.local / "catalogo.json").symlink_to(self.bundle / "catalogo.json")
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.add(), 1)

    def test_ffprobe_real_valida_duracion(self):
        self.assertAlmostEqual(catalogo.audio_duration(self.src), 0.1, places=2)

    def test_add_no_crea_archivos_en_raiz_simbolica(self):
        outside = self.root / "outside"
        outside.mkdir()
        self.local.parent.mkdir()
        self.local.symlink_to(outside, target_is_directory=True)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.add(), 1)
        self.assertEqual(list(outside.iterdir()), [])

    def test_check_y_stage_rechazan_credito_nulo(self):
        self.assertEqual(self.add(license="cc-by", credit="Autor"), 0)
        catalog = catalogo.read_catalog(self.local)
        catalog["sounds"][0]["credit"] = None
        (self.local / "catalogo.json").write_text(json.dumps(catalog), encoding="utf-8")
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(catalogo.main(["check"]), 1)
            self.assertEqual(catalogo.main(["stage", "--project", str(self.root), "clic-suave"]), 1)
        self.assertFalse((self.root / "assets").exists())

    def test_ffprobe_rechaza_audio_multicanal_o_con_extension_falsa(self):
        self.src.rename(self.src.with_suffix(".mp3"))
        with self.assertRaisesRegex(ValueError, "ffprobe"):
            catalogo.audio_duration(self.src.with_suffix(".mp3"))
        with wave.open(str(self.src), "wb") as f:
            f.setparams((4, 2, 48000, 4800, "NONE", "not compressed"))
            f.writeframes(bytes(4 * 2 * 4800))
        with self.assertRaisesRegex(ValueError, "mono o estéreo"):
            catalogo.audio_duration(self.src)

    def test_copia_exclusiva_no_borra_el_archivo_existente(self):
        dest = self.root / "otro.wav"
        dest.write_bytes(b"conservar")
        with self.assertRaises(FileExistsError):
            catalogo.copy_new(self.src, dest)
        self.assertEqual(dest.read_bytes(), b"conservar")

    def test_fallo_al_guardar_conserva_el_indice_anterior(self):
        self.assertEqual(self.add(), 0)
        index = self.local / "catalogo.json"
        first = index.read_bytes()
        with mock.patch.object(catalogo.Path, "replace", side_effect=OSError("fallo simulado")), \
                contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(self.add(ident="segundo"), 1)
        self.assertEqual(index.read_bytes(), first)
        self.assertFalse((self.local / "files/segundo.wav").exists())
        self.assertFalse((self.local / ".catalogo.lock").exists())
        self.assertEqual(self.add(ident="segundo"), 0)

    def test_busqueda_json_filtrable_por_gesto_y_etiqueta(self):
        self.assertEqual(self.add(), 0)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(catalogo.main(["list", "--gesture", "pulsar", "--tag", "ui", "--json"]), 0)
        rows = json.loads(out.getvalue())
        self.assertEqual([i["id"] for i in rows], ["clic-suave"])
        self.assertEqual(rows[0]["library"], "personal")


    def test_registro_usa_las_mismas_restricciones_de_decodificacion(self):
        # Un FFprobe exitoso no prueba compatibilidad con libsndfile.
        # Reproducimos un formato que sf.SoundFile no pudiera abrir.
        with mock.patch("soundfile.SoundFile", side_effect=RuntimeError("Unsupported codec")), \
             contextlib.redirect_stderr(io.StringIO()):
            rc = catalogo.main([
                "add", str(self.src), "--id", "fallo", "--name", "Fallo",
                "--family", "click", "--gesture", "boton", "--energy", "low",
                "--license", "own", "--source", "grabacion-propia",
            ])
        self.assertEqual(rc, 1)
        self.assertEqual(catalogo.read_catalog(self.local)["sounds"], [])
        self.assertFalse((self.local / "files/fallo.wav").exists())

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg no disponible")
    def test_ogg_speex_de_ffprobe_no_pasa_si_soundfile_no_puede_decodificar(self):
        import soundfile as sf
        speex = self.root / "speex.ogg"
        job = subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
            "-i", "anullsrc=r=16000:cl=mono", "-t", "0.25",
            "-c:a", "libspeex", "-y", str(speex)
        ], capture_output=True, text=True)
        if job.returncode:
            self.skipTest("libspeex no está disponible en el FFmpeg del entorno")
        probe = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1", str(speex)
        ], capture_output=True, text=True, check=True)
        self.assertEqual(probe.stdout.strip(), "speex")
        try:
            # Comprueba la compatibilidad real de SoundFile con el códec.
            sf.read(str(speex), dtype="float32", always_2d=True)
        except (OSError, RuntimeError, ValueError):
            with self.assertRaisesRegex(ValueError, "incompatible con soundfile"):
                catalogo.audio_duration(speex)
        else:
            # Si una versión futura de libsndfile admite Speex, no hay falsa incompatibilidad.
            self.assertGreater(catalogo.audio_duration(speex), 0)

    def test_check_rechaza_archivo_no_decodificable_aunque_conserve_su_hash(self):
        self.assertEqual(self.add(), 0)
        with mock.patch("soundfile.SoundFile", side_effect=RuntimeError("No readable")):
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(catalogo.main(["check"]), 1)



if __name__ == "__main__":
    unittest.main()
