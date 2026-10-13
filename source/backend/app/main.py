import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import Client, Account

from app.api.clients import router as clients_router
from app.api.accounts import router as accounts_router
from app.api.account_dashboard import router as account_dashboard_router
from app.api.account_intelligence import router as account_intelligence_router
from app.api.account_signals import router as account_signals_router
from app.api.client_context import router as client_context_router
from app.api.qbc_results import router as qbc_results_router
from app.api.relevancy_results import router as relevancy_results_router
from app.api.search_results import router as search_results_router
from app.api.signals import router as signals_router
from app.api.account_signals import client_router as client_account_signals_router


Base.metadata.create_all(bind=engine)

app = FastAPI(title="VisionScaleX Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://192.168.1.5:5174",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "VisionScaleX Backend is running"
    }


app.include_router(clients_router)
app.include_router(accounts_router)
app.include_router(account_dashboard_router)
app.include_router(account_intelligence_router)
app.include_router(account_signals_router)
app.include_router(client_account_signals_router)
app.include_router(client_context_router)
app.include_router(qbc_results_router)
app.include_router(relevancy_results_router)
app.include_router(search_results_router)
app.include_router(signals_router)
