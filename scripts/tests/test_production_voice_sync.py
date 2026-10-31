from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("voice_sync", ROOT / "scripts/lib/voice-sync.py")
voice_sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(voice_sync)


class VoiceSyncTests(unittest.TestCase):
    def test_tokens_normalize_accents_and_punctuation(self):
        self.assertEqual(voice_sync.tokens("¡Café, en 2026!"), ["cafe", "en", "2026"])

    def test_phrase_matching_uses_alternatives_and_preserves_order(self):
        words = [
            {"text": "We", "start": 0.4, "end": 0.5},
            {"text": "begin", "start": 0.55, "end": 0.7},
            {"text": "again", "start": 1.4, "end": 1.55},
            {"text": "today", "start": 1.6, "end": 1.8},
        ]
        phrases = [["open", "Start now|We begin", "We start"], ["close", "again today", "Again today"]]
        self.assertEqual(voice_sync.phrase_word_indices(words, phrases), [0, 2])

    def test_phrase_alignment_uses_silence_anchors_and_word_timestamps(self):
        words = [
            {"text": "We", "start": 0.4, "end": 0.5},
            {"text": "begin", "start": 0.55, "end": 0.7},
            {"text": "again", "start": 1.4, "end": 1.55},
            {"text": "today", "start": 1.6, "end": 1.8},
        ]
        phrases = [["open", "We begin", "We start"], ["close", "again today", "Again today"]]
        lines = voice_sync.align_phrase_lines(words, phrases, [0.25, 1.2], [0.0, 1.9], 2.0)
        self.assertEqual([line["inicio"] for line in lines], [0.25, 1.2])
        self.assertEqual([line["fin"] for line in lines], [1.2, 1.9])
        self.assertEqual([word["t"] for word in lines[0]["palabras"]], ["We", "start"])
        self.assertEqual([word["t"] for word in lines[1]["palabras"]], ["Again", "today"])

    def test_changed_word_count_distributes_canonical_subtitle_words_by_phrase_span(self):
        words = [
            {"text": "We", "start": 0.4, "end": 0.5},
            {"text": "begin", "start": 0.55, "end": 0.7},
        ]
        lines = voice_sync.align_phrase_lines(words, [["open", "We begin", "We are beginning"]], [0.25], [0.0, 1.0], 1.2)
        self.assertEqual([word["t"] for word in lines[0]["palabras"]], ["We", "are", "beginning"])
        self.assertTrue(all(word["f"] >= word["i"] for word in lines[0]["palabras"]))

    def test_time_map_uses_matching_sentence_starts_and_manual_endpoints(self):
        old = [
            {"text": "Alpha", "start": 0.5, "end": 0.6},
            {"text": "beta", "start": 0.7, "end": 0.8},
            {"text": "Gamma", "start": 1.5, "end": 1.6},
            {"text": "delta", "start": 1.8, "end": 1.9},
        ]
        new = [
            {"text": "Alpha", "start": 0.4, "end": 0.5},
            {"text": "beta", "start": 0.6, "end": 0.7},
            {"text": "Gamma", "start": 1.3, "end": 1.4},
            {"text": "delta", "start": 1.7, "end": 1.8},
        ]
        anchors = voice_sync.build_time_map(old, new, [0.4, 1.4], [0.3, 1.2], [[2.0, 1.9]])
        self.assertEqual(anchors, [[0.0, 0.0], [0.4, 0.3], [1.4, 1.2], [2.0, 1.9]])

    def test_time_map_rejects_crossing_or_duplicate_manual_anchors(self):
        with self.assertRaisesRegex(ValueError, "increase strictly"):
            voice_sync.strict_anchors([[0, 0], [1, 2], [2, 1]])
        with self.assertRaisesRegex(ValueError, "increase strictly"):
            voice_sync.strict_anchors([[0, 0], [1, 1], [1, 2]])


if __name__ == "__main__":
    unittest.main()
