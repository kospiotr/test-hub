import random

import pytest

from pytes_example import add, divide, multiply, subtract


class TestRandomlyFailing:
    """Tests that randomly fail to simulate flaky tests."""

    def test_flaky_addition(self) -> None:
        """This test fails randomly about 40% of the time."""
        if random.random() < 0.4:
            assert False, "Random failure in addition test"
        result = add(10, 5)
        assert result == 15

    def test_flaky_multiplication(self) -> None:
        """This test fails randomly about 50% of the time."""
        if random.random() < 0.5:
            assert False, "Random failure in multiplication test"
        result = multiply(3, 7)
        assert result == 21

    def test_flaky_division(self) -> None:
        """This test fails randomly about 30% of the time."""
        if random.random() < 0.3:
            assert False, "Random failure in division test"
        result = divide(20, 4)
        assert result == 5

