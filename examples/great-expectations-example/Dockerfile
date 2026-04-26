FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY tests ./tests

RUN pip install --no-cache-dir -e .

CMD ["pytest", "-q"]
