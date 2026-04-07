# Build context: monorepo root  (docker build -f packages/scoring/Dockerfile .)
FROM python:3.12-slim
WORKDIR /app

COPY packages/scoring/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/scoring/*.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
