#!/usr/bin/env python3
"""Regressões das grandezas de qualidade / Quality-quantity regressions.

Values come from IBGE (1983), Table VI, p. 30, and IBGE (2019), pp. 35-36.
Run: python3 -m unittest -v test_sgb_altimetria_numeros.py
"""
import contextlib
import io
import unittest

import sgb_altimetria_numeros as aula


class LevellingQualityTests(unittest.TestCase):
    """Controles distintos, exemplos e proveniência / Checks, examples and provenance."""

    def test_section_examples_have_the_documented_acceptance(self):
        """As duas seções da aula / The two classroom sections."""
        discrepancy = abs(12.347 - 12.343) * 1000
        self.assertAlmostEqual(discrepancy, 4.0)
        self.assertLess(discrepancy, aula.section_tolerance_mm(2.8))
        self.assertEqual(f"{aula.section_tolerance_mm(2.8):.1f}", "5.0")
        discrepancy = abs(8.912 - 8.904) * 1000
        self.assertGreater(discrepancy, aula.section_tolerance_mm(2))
        self.assertEqual(f"{aula.section_tolerance_mm(2):.1f}", "4.2")

    def test_line_discrepancy_and_adjusted_precision_are_different(self):
        """Linha de 16 km: 16 mm versus 8 mm / A 16-km line: 16 vs 8 mm."""
        self.assertEqual(aula.line_tolerance_mm(16), 16.0)
        self.assertEqual(aula.adjusted_line_std_limit_mm(16), 8.0)

    def test_circuit_check_uses_perimeter_linearly(self):
        """Circuitos de 39 e 100 km / 39- and 100-km circuits."""
        closure_mm = (15.4301 - 4.2276 - 13.7819 + 2.5854) * 1000
        self.assertAlmostEqual(closure_mm, 6.0)
        self.assertEqual(aula.circuit_closure_limit_mm(39), 19.5)
        self.assertEqual(aula.circuit_closure_limit_mm(100), 50.0)
        self.assertLess(abs(closure_mm), aula.circuit_closure_limit_mm(39))
        self.assertEqual(f"{abs(closure_mm) / 39:.3f}", "0.154")

    def test_section_check_does_not_accept_a_line_as_a_section(self):
        """Seção fundamental até 3 km / Fundamental section up to 3 km."""
        for length in (-1, 3.2, 5, 39):
            with self.subTest(length=length), self.assertRaises(ValueError):
                aula.section_tolerance_mm(length)

    def test_residual_distance_normalization(self):
        """Normalização dimensional por distância / Dimensional distance normalization."""
        self.assertEqual(aula.distance_normalized_residual(6, 9), 2.0)
        self.assertEqual(aula.distance_normalized_residual(-6, 9), -2.0)
        for length in (0, -1):
            with self.subTest(length=length), self.assertRaises(ValueError):
                aula.distance_normalized_residual(1, length)

    def test_benchmark_compatibility_uses_covariance(self):
        """Diferença nova-publicada / New-minus-published difference."""
        sigma = aula.benchmark_difference_std_mm(3, 4, 4, 8)
        self.assertEqual(sigma, 5.0)
        discrepancy = (7.759 - (20.100 - 12.345)) * 1000
        self.assertAlmostEqual(abs(discrepancy) / sigma, 0.8)
        self.assertGreater(aula.benchmark_difference_std_mm(3, 4, 4, 0), sigma)
        with self.assertRaises(ValueError):
            aula.benchmark_difference_std_mm(3, 4, 4, 17)

    def test_primary_block_counts_and_empirical_frequencies(self):
        """Dados do bloco principal de 2018 / 2018 principal-block figures."""
        self.assertEqual(aula.REALT2018_MAIN_BENCHMARKS, 66882)
        self.assertEqual(aula.REALT2018_MAIN_SECTIONS, 70426)
        self.assertEqual(aula.REALT2018_CIRCUIT_RESIDUAL_SECTIONS, 62782)
        self.assertEqual(aula.REALT2018_RESIDUAL_PERCENTAGES,
                         ((1, 92.7), (2, 98.0), (3, 99.1), (4, 99.5)))
        self.assertEqual(aula.SANTANA_ADOPTION_YEAR, 1980)

    def test_no_2018_frequency_is_applied_to_2011_observations(self):
        """Saída sem a antiga conta de 370 seções / Output omits the old 370-section claim."""
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            aula.aula3()
        quality = output.getvalue().split("REALT-2018: resíduos do bloco principal")[1]
        self.assertIn("not field-acceptance requirements", quality)
        self.assertNotIn("0,5 % são", quality)
        self.assertNotIn("370", quality)

    def test_four_node_worked_example_remains_consistent(self):
        """Exemplo MMQ preservado / Preserved least-squares worked example."""
        result = aula.mmq(aula.NOS, {"A": aula.H_A}, aula.OBS)
        heights = result[-1]
        self.assertEqual(result[6], 3)
        for name, expected in {"B": 12.3487, "C": 9.8670, "D": 11.1220}.items():
            self.assertAlmostEqual(heights[name], expected, places=4)


if __name__ == "__main__":
    unittest.main()

