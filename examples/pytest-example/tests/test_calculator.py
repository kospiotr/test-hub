import pytest

from pytes_example import add, divide, multiply, subtract


def test_add() -> None:
    assert add(2, 3) == 5


def test_subtract() -> None:
    assert subtract(10, 4) == 6


@pytest.mark.parametrize(
    ("a", "b", "expected"),
    [
        (2, 3, 6),
        (-1, 5, -5),
        (0, 99, 0),
    ],
)
def test_multiply(a: float, b: float, expected: float) -> None:
    assert multiply(a, b) == expected


def test_divide() -> None:
    assert divide(12, 3) == 4


def test_divide_by_zero_raises() -> None:
    with pytest.raises(ValueError, match="divide by zero"):
        divide(1, 0)
