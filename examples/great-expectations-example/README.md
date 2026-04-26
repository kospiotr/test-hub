# great-expectations-example

Minimal Python project with `pytest` tests using the Great Expectations framework.

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
docker build -t localhost/great-expectations-example-tests:1.0.0 .
```

Run tests:

```bash
docker run --rm localhost/great-expectations-example-tests:1.0.0
```
