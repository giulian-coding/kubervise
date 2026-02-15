from fastapi import FastAPI
import uvicorn
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException
import urllib3
import asyncio
import numpy



app = FastAPI()
config.load_kube_config()
v1 = client.CoreV1Api()

def status() -> bool:
    try:
        v1.list_namespace(limit=1, _request_timeout=3)
        return True

    except Exception:
        return False

@app.get("/")
async def root():
    running = await asyncio.to_thread(status)
    return {"message": running}

@app.get("/namespaces")
async def get_namespaces():
    return {"message": "yo"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)