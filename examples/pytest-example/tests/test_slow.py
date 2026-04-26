import time

import pytest

from pytes_example import add, divide, multiply, subtract


class TestSimpleCalculations:
    """Simple calculation operations tests."""

    def test_slow_add_positive_numbers(self) -> None:
        time.sleep(60)
        assert add(5, 10) == 15

    def test_slow_add_negative_numbers(self) -> None:
        time.sleep(5)
        assert add(-5, -10) == -15

    def test_slow_add_mixed_numbers(self) -> None:
        time.sleep(10)
        assert add(-5, 10) == 5

    def test_slow_subtract_positive_numbers(self) -> None:
        time.sleep(2)
        assert subtract(20, 8) == 12

    def test_slow_subtract_negative_numbers(self) -> None:
        time.sleep(15)
        assert subtract(-10, -5) == -5

    def test_slow_multiply_positive_numbers(self) -> None:
        time.sleep(60)
        assert multiply(4, 7) == 28

    def test_slow_multiply_by_zero(self) -> None:
        time.sleep(3)
        assert multiply(100, 0) == 0

    def test_slow_multiply_negative_numbers(self) -> None:
        time.sleep(20)
        assert multiply(-3, -4) == 12

    def test_slow_divide_exact_division(self) -> None:
        time.sleep(60)
        assert divide(15, 3) == 5

    def test_slow_divide_with_decimals(self) -> None:
        time.sleep(8)
        assert divide(10, 4) == 2.5

    def test_slow_divide_negative_numbers(self) -> None:
        time.sleep(30)
        assert divide(-20, 4) == -5

    @pytest.mark.parametrize(
        ("a", "b", "expected"),
        [
            (1, 1, 2),
            (100, 200, 300),
            (-50, 50, 0),
            (0.5, 0.5, 1.0),
        ],
    )
    def test_slow_add_parametrized(self, a: float, b: float, expected: float) -> None:
        time.sleep(12)
        assert add(a, b) == expected

    @pytest.mark.parametrize(
        ("a", "b", "expected"),
        [
            (10, 2, 5),
            (100, 5, 20),
            (7, 2, 3.5),
        ],
    )
    def test_slow_divide_parametrized(self, a: float, b: float, expected: float) -> None:
        time.sleep(25)
        assert divide(a, b) == expected

