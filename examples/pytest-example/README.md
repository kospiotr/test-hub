# pytes-example

Minimal Python project with `pytest` tests.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Run tests

```bash
pytest -q
```

## Run tests with Docker

Build image:

```bash
docker build -t pytest-example-tests .
```

Run tests:

```bash
docker run --rm pytest-example-tests
```
