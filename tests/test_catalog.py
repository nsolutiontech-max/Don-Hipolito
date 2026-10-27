"""Verify source parity without changing generated files."""
import importlib.util
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("catalog_generator", ROOT / "scripts/generar-seed3.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class CatalogueTest(unittest.TestCase):
    def test_manifest_matches_all_source_cells(self):
        source = generator.inventory_items(generator.read_sheets())
        manifest = json.loads((ROOT / "Docs/catalogo-conciliado.json").read_text(encoding="utf-8"))
        self.assertEqual(source, manifest)
        self.assertEqual(Counter(i["codigo"] for i in source), {"STOCK_A": 57, "STOCK_B": 60, "STOCK_C": 58, "BEBIDAS": 47})

    def test_presentation_distinguishes_repeated_drink_names(self):
        items = generator.inventory_items(generator.read_sheets())
        cola = [i["presentacion"] for i in items if i["codigo"] == "BEBIDAS" and i["nombre"] == "Coca-Cola Original"]
        self.assertEqual(cola, ["350 cc", "1 L"])

    def test_normalization_retains_initial_capitals(self):
        self.assertEqual(generator.normalize("Zapallo Cabutiá"), generator.normalize("zapallo cabutia"))


if __name__ == "__main__":
    unittest.main()
