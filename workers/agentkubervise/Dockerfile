FROM python:3.11-slim

WORKDIR /app

# Kubernetes Client benötigt diese
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make CLI executable
RUN chmod +x cli.py

# Default: Run the CLI agent
# Override with environment variables:
#   KUBERVISE_API_URL, KUBERVISE_AGENT_TOKEN, KUBERVISE_CLUSTER_ID
ENTRYPOINT ["python", "cli.py"]

# Or for the legacy FastAPI server mode:
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
