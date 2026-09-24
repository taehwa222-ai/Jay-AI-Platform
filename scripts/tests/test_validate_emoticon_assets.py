import importlib.util
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "validate-emoticon-assets.py"
SPEC = importlib.util.spec_from_file_location("validate_emoticon_assets", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type)
    checksum = zlib.crc32(data, checksum) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", checksum)


def make_png(width: int = 1, height: int = 1, color_type: int = 2) -> bytes:
    channels = 4 if color_type == 6 else 3
    raw = b"".join(b"\x00" + (b"\x00" * width * channels) for _ in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    return (
        MODULE.PNG_SIGNATURE
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw))
        + png_chunk(b"IEND", b"")
    )


class InspectPngTests(unittest.TestCase):
    def test_reads_dimensions_and_alpha_without_modifying_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.png"
            original = make_png(width=3, height=2, color_type=6)
            path.write_bytes(original)

            result = MODULE.inspect_png(path)

            self.assertTrue(result["is_png"])
            self.assertFalse(result["corrupted"])
            self.assertEqual((result["width"], result["height"]), (3, 2))
            self.assertTrue(result["has_alpha_channel"])
            self.assertEqual(path.read_bytes(), original)

    def test_reports_corrupt_png(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "broken.png"
            path.write_bytes(MODULE.PNG_SIGNATURE + b"broken")

            result = MODULE.inspect_png(path)

            self.assertTrue(result["is_png"])
            self.assertTrue(result["corrupted"])


class ValidationTests(unittest.TestCase):
    def test_detects_duplicate_assets_and_keeps_manifest_item_valid(self):
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            asset_dir = project / "assets" / "set"
            pilot_dir = project / "assets" / "pilot"
            asset_dir.mkdir(parents=True)
            pilot_dir.mkdir(parents=True)
            image = make_png()
            (asset_dir / "01-ok-v1.png").write_bytes(image)
            (pilot_dir / "01-ok-v1.png").write_bytes(image)
            manifest = {
                "project": {"slug": "test"},
                "project_rules": {
                    "filename_pattern": r"^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*-v(\d+)\.png$"
                },
                "sets": [
                    {
                        "set_id": "set",
                        "expected_count": 1,
                        "items": [
                            {
                                "number": 1,
                                "filename": "01-ok-v1.png",
                                "path": "assets/set/01-ok-v1.png",
                                "image": {"width": 1, "height": 1, "format": "PNG"},
                            }
                        ],
                    }
                ],
            }
            config = {"verification": {"status": "unverified"}, "static_image": {}}

            result = MODULE.validate(project, manifest, config)

            self.assertEqual(result["summary"]["failed_manifest_items"], 0)
            self.assertEqual(result["summary"]["failed_set_configurations"], 0)
            self.assertEqual(result["summary"]["duplicate_groups"], 1)
            self.assertEqual(result["sets"][0]["missing_numbers"], [])

    def test_applies_configured_count_and_animation_rules(self):
        set_data = {"animation": False}
        config = {
            "static_image": {"required_count": 32},
            "animation": {"required": False, "allowed": False},
        }

        checks = MODULE.set_config_checks(set_data, 31, config)

        statuses = {check["name"]: check["status"] for check in checks}
        self.assertEqual(statuses["required_count"], "fail")
        self.assertEqual(statuses["animation.required"], "pass")
        self.assertEqual(statuses["animation.allowed"], "pass")


if __name__ == "__main__":
    unittest.main()
